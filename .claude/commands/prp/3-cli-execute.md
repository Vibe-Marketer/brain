# Execute BASE PRP (CLI Agent)

Implement a feature using the PRP file.

## PRP File: $ARGUMENTS

## When to Use This Command

✅ **Use 3-cli-execute.md when:**
- Working with CLI agents (non-interactive environments)
- Executing PRPs created with 1-cli-create.md
- Need straightforward execution workflow
- Want lighter-weight implementation process
- Low-to-medium complexity features

❌ **Use 3-execute.md instead when:**
- Need comprehensive 4-level progressive validation
- Executing complex PRPs from 1-create.md
- Want systematic validation gates

❌ **Use 3-story-task-execute.md instead when:**
- Executing story/task PRPs
- Need task-by-task sequential validation
- Working with structured task breakdown

---

## Execution Process

### Step 0: Pre-Execution Validation

**BEFORE starting implementation**, run validation to ensure environment readiness:

```bash
# Invoke /prp-validate command
/prp-validate $ARGUMENTS

# Validation checks:
- ✅ All referenced files exist
- ✅ URLs are accessible
- ✅ Dependencies installed
- ✅ API keys configured
- ✅ Environment ready
```

**If validation fails**: Fix issues before proceeding with implementation.

**If validation passes**: Continue to Step 1.

---

1. **Load PRP**
   - Read the specified PRP file
   - Understand all context and requirements
   - Follow all instructions in the PRP and extend the research if needed
   - Ensure you have all needed context to implement the PRP fully
   - Do more web searches and codebase exploration as needed

2. **ULTRATHINK**
   - Think hard before you execute the plan. Create a comprehensive plan addressing all requirements.
   - Break down complex tasks into smaller, manageable steps using your todos tools.
   - Use the TodoWrite tool to create and track your implementation plan.
   - Identify implementation patterns from existing code to follow.

3. **Execute the plan**
   - Execute the PRP
   - Implement all the code

4. **Validate**
   - Run each validation command
   - Fix any failures
   - Re-run until all pass

5. **Complete**
   - Ensure all checklist items done
   - Run final validation suite
   - Report completion status
   - Read the PRP again to ensure you have implemented everything

6. **Reference the PRP**
   - You can always reference the PRP again if needed

Note: If validation fails, use error patterns in PRP to fix and retry.
