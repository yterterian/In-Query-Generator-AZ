# projectbrief.md

## Solution Overview

This `projectbrief.md` file is specifically designed to provide comprehensive context to AI pair programming tools about the **Enhanced In-Query Statement Generator** VS Code extension project.

### Key Features of This Brief

1. **Accurate Project Description**: Based on the actual codebase analysis from `package.json`, source files, and test structure
2. **Technical Context**: Includes architecture constraints and technical decisions that an AI should understand
3. **Clear Scope Boundaries**: Explicitly defines what is and isn't part of the project to guide AI suggestions
4. **Stakeholder Context**: Helps the AI understand the user base and use cases
5. **Success Criteria**: Provides measurable goals for the AI to optimise towards

### AI Context Considerations

* **Pure Function Architecture**: The project uses `src/pure.ts` for logic without VS Code dependencies
* **Testing Strategy**: Comprehensive testing approach with both unit and integration tests
* **Configuration Management**: Extensive VS Code settings integration
* **Cross-platform Requirements**: Must work consistently across Windows, macOS, and Linux
* **Performance Constraints**: Must handle large datasets efficiently and avoid blocking the UI thread

### Usage by AI Pair Programming Tools

This brief will help AI tools (e.g., Cline) understand:

* What changes are appropriate within project scope
* Technical constraints that must be respected
* User experience expectations
* Code quality standards
* Testing requirements
