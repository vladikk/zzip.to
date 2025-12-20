# LLM Task Implementation Prompt Template

Use this prompt to have an LLM implement any task from TASKS.md. Replace `{TASK_NUMBER}` with the actual task number (1-11).

---

## Prompt Template

```
You are implementing a task for the zzip.to project - an AWS CloudFront-based URL redirect service.

# PROJECT CONTEXT

## What is zzip.to?
A serverless URL shortener/redirect service that uses AWS edge infrastructure to serve fast global redirects without servers or Lambda functions.

Example functionality:
- https://zzip.to/gh → redirects to https://github.com/
- https://zzip.to/gh/vladikk → redirects to https://github.com/vladikk

## Architecture Overview
- **CloudFront Distribution**: HTTPS termination and request routing
- **CloudFront Function**: JavaScript executed at edge for redirect logic
- **CloudFront KeyValueStore**: Stores key→URL mappings
- **AWS WAF**: Rate limiting and security rules
- **S3 Bucket**: Access logs storage
- **Infrastructure**: AWS CloudFormation (YAML)

## Key Technical Details
1. **Redirect Types**:
   - Wildcard: `gh → https://github.com/*` (appends extra path)
   - Exact: `docs → https://docs.example.com` (no extra path allowed)

2. **Security Validation**:
   - Allowed characters: A-Z, a-z, 0-9, _, -, /
   - Max path length: 256 characters
   - Blocks: .., //, %2F, %2f

3. **Deployment**:
   - Must use us-east-1 region (CloudFront/WAF requirement)
   - Multi-environment support (dev, test, prod)
   - Resources prefixed with environment and stack name

## Project Files Structure
```
/
├── cloudformation/
│   └── redirect-service.yaml       # CloudFormation template (built progressively)
├── functions/
│   └── redirect-function.js        # CloudFront Function code
├── tests/
│   ├── function-test-cases.md      # Test documentation
│   └── run-tests.sh                # Automated test script
├── .gitignore
├── README.md                        # Deployment guide
├── requirements.md                  # Architecture requirements (SOURCE OF TRUTH)
├── TASKS.md                         # Task breakdown (YOU ARE IMPLEMENTING ONE TASK)
└── deploy.sh                        # Deployment automation script
```

# YOUR TASK

You are implementing **Task {TASK_NUMBER}** from TASKS.md.

## Instructions

1. **Read the task definition**:
   - Read the entire Task {TASK_NUMBER} section from TASKS.md
   - Understand the Objective, Prerequisites, and Explicit Instructions

2. **Verify prerequisites**:
   - Check that all prerequisite tasks' deliverables exist
   - If missing, STOP and report what's missing

3. **Follow instructions EXACTLY**:
   - Do NOT deviate from the explicit instructions
   - Do NOT make assumptions or "improvements"
   - Do NOT skip steps
   - Use the EXACT values, formats, and syntax specified

4. **Create all deliverables**:
   - Create/modify all files listed in the Deliverables section
   - Follow the exact structure and format specified

5. **Validate your work**:
   - Run ALL commands in the "Testing Instructions" section
   - Ensure ALL acceptance criteria are met
   - Fix any issues before considering the task complete

6. **Report completion**:
   - List all files created/modified
   - Confirm all acceptance criteria are met
   - Provide the "Notes for Next Task" content for the next engineer

## Important Rules

- **NEVER** skip or summarize code - write COMPLETE implementations
- **NEVER** use placeholders like `// ... rest of code` - write EVERYTHING
- **NEVER** assume context from previous tasks - read files if you need information
- **ALWAYS** use exact values specified (don't change names, types, formats)
- **ALWAYS** validate your work with the provided test commands
- **IF** instructions say "Do NOT modify", then don't modify
- **IF** uncertain, re-read the instructions - they contain the answer

## Example Validation Process

After completing your task:

```bash
# 1. Check files exist
ls -la [files you created/modified]

# 2. Run validation commands from task
[copy commands from "Testing Instructions" section]

# 3. Verify acceptance criteria
# Go through checklist item by item

# 4. If anything fails, fix and re-test
```

## What to Read

You MUST read these sections:
1. **TASKS.md** → Task {TASK_NUMBER} (complete section)
2. **requirements.md** → Referenced sections (if any mentioned in task)
3. **Prerequisite files** → Any files that should exist from previous tasks

## Output Format

Provide your implementation in this format:

### 1. Prerequisites Check
- [x] Prerequisite 1 verified (file X exists)
- [x] Prerequisite 2 verified (...)

### 2. Implementation
[Show your work: file creations, modifications]

### 3. Validation Results
```bash
[Output of running test commands]
```

### 4. Acceptance Criteria
- [x] Criterion 1: [evidence]
- [x] Criterion 2: [evidence]
...

### 5. Deliverables Summary
- Created: [list files]
- Modified: [list files]

### 6. Notes for Next Task
[Copy the "Notes for Next Task" from the task definition]

---

Now, implement Task {TASK_NUMBER} following these instructions exactly.
```

---

## Usage Examples

### Example 1: Implementing Task 1

Replace `{TASK_NUMBER}` with `1`:

```
You are implementing a task for the zzip.to project...
[full prompt]
...
You are implementing **Task 1** from TASKS.md.
...
You MUST read these sections:
1. **TASKS.md** → Task 1 (complete section)
...
Now, implement Task 1 following these instructions exactly.
```

### Example 2: Implementing Task 4

Replace `{TASK_NUMBER}` with `4`:

```
You are implementing a task for the zzip.to project...
[full prompt]
...
You are implementing **Task 4** from TASKS.md.
...
You MUST read these sections:
1. **TASKS.md** → Task 4 (complete section)
2. **requirements.md** → Referenced sections (if any mentioned in task)
...
Now, implement Task 4 following these instructions exactly.
```

## Tips for Best Results

1. **Use with capable models**: Claude Sonnet 3.5+, GPT-4, etc.
2. **Provide file access**: Ensure the LLM can read TASKS.md and requirements.md
3. **Sequential execution**: Complete tasks in order (1→2→3...→11)
4. **Verify between tasks**: Check deliverables before moving to next task
5. **Fresh context**: Start each task with clean context (no carryover assumptions)

## Automation Script

To automate task execution with an LLM API:

```bash
#!/usr/bin/env bash
# automate-tasks.sh - Run all tasks sequentially

for TASK_NUM in {1..11}; do
    echo "Implementing Task $TASK_NUM..."

    # Generate prompt by replacing {TASK_NUMBER}
    PROMPT=$(sed "s/{TASK_NUMBER}/$TASK_NUM/g" TASK_PROMPT_TEMPLATE.md)

    # Call your LLM API (example with Claude API)
    # Replace with your actual API call
    curl https://api.anthropic.com/v1/messages \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "content-type: application/json" \
        -d "{
            \"model\": \"claude-sonnet-4-20250514\",
            \"max_tokens\": 8192,
            \"messages\": [{
                \"role\": \"user\",
                \"content\": \"$PROMPT\"
            }]
        }"

    # Wait for user to verify before continuing
    read -p "Task $TASK_NUM complete. Verify and press Enter to continue..."
done

echo "All tasks completed!"
```

## Quality Checklist

Before considering a task complete:

- [ ] All files in Deliverables section exist
- [ ] All Testing Instructions commands run successfully
- [ ] All Acceptance Criteria checkboxes can be checked
- [ ] No errors or warnings from validation commands
- [ ] Code is complete (no placeholders or "// TODO")
- [ ] Values match specifications exactly (no substitutions)
- [ ] File formats are correct (YAML, JavaScript, Bash, etc.)

## Common Pitfalls to Avoid

1. **Placeholder code**: Never use "// rest of implementation" - write everything
2. **Assumption errors**: Don't assume values - use exactly what's specified
3. **Skipping validation**: Always run test commands before marking complete
4. **Format deviations**: Use exact formats specified (spacing, indentation, quotes)
5. **Incomplete work**: Partial implementations are worse than no implementation
6. **Cross-task confusion**: Each task is independent - don't mix concerns

## Troubleshooting

**If LLM says "I don't have enough context":**
- Ensure it can read TASKS.md and requirements.md
- Point it to specific sections in those files
- Remind it that all context is in the task definition

**If LLM makes assumptions:**
- Remind it to follow "Explicit Instructions" exactly
- Point out the specific instruction it deviated from
- Reset and try again with emphasis on "no assumptions"

**If LLM writes incomplete code:**
- Remind it that placeholders are not allowed
- Ask it to expand any "// ..." sections
- Specify: "Write the complete, production-ready implementation"

**If validation fails:**
- Show the LLM the error output
- Ask it to fix based on acceptance criteria
- Re-run validation commands

---

## Version History

- v1.0 - Initial template (matches TASKS.md structure)
