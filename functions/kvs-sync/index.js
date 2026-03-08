require('@aws-sdk/signature-v4a');
const { CloudFrontKeyValueStoreClient, DescribeKeyValueStoreCommand, PutKeyCommand, DeleteKeyCommand } = require('@aws-sdk/client-cloudfront-keyvaluestore');
const client = new CloudFrontKeyValueStoreClient();

async function getETag(kvsArn) {
  const resp = await client.send(new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }));
  return resp.ETag;
}

exports.handler = async (event) => {
  const kvsArn = process.env.KVS_ARN;
  let currentEtag = await getETag(kvsArn);
  for (const record of event.Records) {
    const eventName = record.eventName;
    try {
      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        const newImage = record.dynamodb.NewImage;
        const key = newImage.key.S;
        const value = newImage.value.S;
        try {
          const result = await client.send(new PutKeyCommand({
            KvsARN: kvsArn,
            Key: key,
            Value: value,
            IfMatch: currentEtag
          }));
          currentEtag = result.ETag;
        } catch (putErr) {
          if (putErr.name === 'ConflictException') {
            console.log(`ETag conflict for key ${key}, retrying with fresh ETag`);
            currentEtag = await getETag(kvsArn);
            const result = await client.send(new PutKeyCommand({
              KvsARN: kvsArn,
              Key: key,
              Value: value,
              IfMatch: currentEtag
            }));
            currentEtag = result.ETag;
          } else {
            throw putErr;
          }
        }
        console.log(`KVS put: ${key} -> ${value}`);
      } else if (eventName === 'REMOVE') {
        const oldImage = record.dynamodb.OldImage;
        const key = oldImage.key.S;
        try {
          const result = await client.send(new DeleteKeyCommand({
            KvsARN: kvsArn,
            Key: key,
            IfMatch: currentEtag
          }));
          currentEtag = result.ETag;
          console.log(`KVS delete: ${key}`);
        } catch (deleteErr) {
          if (deleteErr.name === 'ResourceNotFoundException') {
            console.log(`KVS key already deleted: ${key}`);
            currentEtag = await getETag(kvsArn);
          } else if (deleteErr.name === 'ConflictException') {
            console.log(`ETag conflict for delete ${key}, retrying with fresh ETag`);
            currentEtag = await getETag(kvsArn);
            try {
              const result = await client.send(new DeleteKeyCommand({
                KvsARN: kvsArn,
                Key: key,
                IfMatch: currentEtag
              }));
              currentEtag = result.ETag;
              console.log(`KVS delete (retry): ${key}`);
            } catch (retryErr) {
              if (retryErr.name === 'ResourceNotFoundException') {
                console.log(`KVS key already deleted on retry: ${key}`);
              } else {
                throw retryErr;
              }
            }
          } else {
            throw deleteErr;
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${eventName} for record:`, JSON.stringify(record), err);
      throw err;
    }
  }
};
