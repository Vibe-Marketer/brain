# Execute BASE PRP (Progressive Validation)

## PRP File: $ARGUMENTS

## When to Use This Command

✅ **Use 3-execute.md when:**
- Executing PRPs created with 1-create.md (deep research)
- Complex features requiring 4-level progressive validation
- Need systematic validation gates (syntax → unit → integration → custom)
- Optimizing for one-pass implementation success
- Feature has comprehensive PRP with detailed validation steps

❌ **Use 3-story-task-execute.md instead when:**
- Executing story/task PRPs from 1-story-task-create.md
- Need task-by-task sequential completion
- Prefer immediate validation after each task

❌ **Use 3-cli-execute.md instead when:**
- Working with CLI agents
- Need lighter-weight execution approach
- PRP created with 1-cli-create.md

---

## Mission: One-Pass Implementation Success

PRPs enable working code on the first attempt through:

- **Context Completeness**: Everything needed, nothing guessed
- **Progressive Validation**: 4-level gates catch errors early
- **Pattern Consistency**: Follow existing codebase approaches

**Your Goal**: Transform the PRP into working code that passes all validation gates.

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
   - Read the specified PRP file completely
   - Absorb all context, patterns, requirements and gather codebase intelligence
   - Use the provided documentation references and file patterns, consume the right documentation before the appropriate todo/task
   - Trust the PRP's context and guidance - it's designed for one-pass success
   - If needed do additional codebase exploration and research as needed

2. **ULTRATHINK & Plan**
   - Create comprehensive implementation plan following the PRP's task order
   - Break down into clear todos using TodoWrite tool
   - Use subagents for parallel work when beneficial (always create prp inspired prompts for subagents when used)
   - Follow the patterns referenced in the PRP
   - Use specific file paths, class names, and method signatures from PRP context
   - Never guess - always verify the codebase patterns and examples referenced in the PRP yourself

3. **Execute Implementation**
   - Follow the PRP's Implementation Tasks sequence, add more detail as needed, especially when using subagents
   - Use the patterns and examples referenced in the PRP
   - Create files in locations specified by the desired codebase tree
   - Apply naming conventions from the task specifications and CLAUDE.md

4. **Progressive Validation**

   **Execute the level validation system from the PRP:**
   - **Level 1**: Run syntax & style validation commands from PRP
   - **Level 2**: Execute unit test validation from PRP
   - **Level 3**: Run integration testing commands from PRP
   - **Level 4**: Execute specified validation from PRP

   **Each level must pass before proceeding to the next.**

5. **Completion Verification**
   - Work through the Final Validation Checklist in the PRP
   - Verify all Success Criteria from the "What" section are met
   - Confirm all Anti-Patterns were avoided
   - Implementation is ready and working

**Failure Protocol**: When validation fails, use the patterns and gotchas from the PRP to fix issues, then re-run validation until passing.
