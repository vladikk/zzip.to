const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Replicate the pre-auth Lambda logic from CloudFormation inline code
function createHandler(allowedEmailsEnv) {
  return async (event) => {
    const allowedEmails = allowedEmailsEnv.split(',').map(e => e.trim().toLowerCase());
    const email = (event.request.userAttributes.email || '').toLowerCase();
    if (!allowedEmails.includes(email)) {
      throw new Error('User is not authorized');
    }
    return event;
  };
}

function makeEvent(email) {
  return {
    request: {
      userAttributes: {
        email: email
      }
    }
  };
}

describe('Pre-Auth Lambda', () => {
  describe('allowed emails', () => {
    it('should allow a whitelisted email', async () => {
      const handler = createHandler('admin@example.com,user@example.com');
      const event = makeEvent('admin@example.com');
      const result = await handler(event);
      assert.deepStrictEqual(result, event);
    });

    it('should allow second email in whitelist', async () => {
      const handler = createHandler('admin@example.com,user@example.com');
      const event = makeEvent('user@example.com');
      const result = await handler(event);
      assert.deepStrictEqual(result, event);
    });

    it('should be case-insensitive for email matching', async () => {
      const handler = createHandler('Admin@Example.com');
      const event = makeEvent('admin@example.com');
      const result = await handler(event);
      assert.deepStrictEqual(result, event);
    });

    it('should handle whitespace around emails in config', async () => {
      const handler = createHandler('  admin@example.com , user@example.com  ');
      const event = makeEvent('admin@example.com');
      const result = await handler(event);
      assert.deepStrictEqual(result, event);
    });

    it('should allow single email in whitelist', async () => {
      const handler = createHandler('only@example.com');
      const event = makeEvent('only@example.com');
      const result = await handler(event);
      assert.deepStrictEqual(result, event);
    });
  });

  describe('rejected emails', () => {
    it('should reject a non-whitelisted email', async () => {
      const handler = createHandler('admin@example.com');
      const event = makeEvent('hacker@evil.com');
      await assert.rejects(
        () => handler(event),
        { message: 'User is not authorized' }
      );
    });

    it('should reject when email is empty', async () => {
      const handler = createHandler('admin@example.com');
      const event = makeEvent('');
      await assert.rejects(
        () => handler(event),
        { message: 'User is not authorized' }
      );
    });

    it('should reject when email attribute is missing', async () => {
      const handler = createHandler('admin@example.com');
      const event = { request: { userAttributes: {} } };
      await assert.rejects(
        () => handler(event),
        { message: 'User is not authorized' }
      );
    });

    it('should reject email with extra characters', async () => {
      const handler = createHandler('admin@example.com');
      const event = makeEvent('admin@example.com.evil.com');
      await assert.rejects(
        () => handler(event),
        { message: 'User is not authorized' }
      );
    });
  });
});
