# Development Scripts

## Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| **Validate Setup** | `npm run validate` | Check development environment |
| **Analyze Codebase** | `npm run analyze` | Generate codebase overview |
| **Quality Check** | `npm run quality` | Code quality metrics |
| **Build All** | `npm run build` | Build all apps and packages |
| **Dev Mode** | `npm run dev` | Start development servers |
| **Run Tests** | `npm run test` | Run all tests |
| **Lint Code** | `npm run lint` | Check code quality |
| **Format Code** | `npm run format` | Format all files |

## Script Details

### Validate Setup (`scripts/validate.ts`)

**Purpose**: Verify development environment is properly configured

**Checks**:
- Node.js version (>= 18)
- npm version (>= 9)
- TypeScript installation
- Project structure
- Package.json files
- Dependencies installed

**Usage**:
```bash
npm run validate
```

**Output**: Pass/fail report with specific issues

### Analyze Codebase (`scripts/analyze.ts`)

**Purpose**: Generate overview of current codebase structure

**Analyzes**:
- File count by type
- Function count per module
- Import/export relationships
- Code complexity metrics
- Last modified dates

**Usage**:
```bash
npm run analyze
```

**Output**: JSON report saved to `docs/codebase-analysis.json`

### Quality Check (`scripts/quality.ts`)

**Purpose**: Assess code quality and maintainability

**Metrics**:
- TypeScript errors
- Test coverage
- Code complexity
- Code smells detection
- Maintainability score

**Usage**:
```bash
npm run quality
```

**Output**: Quality report with actionable recommendations

## Script Implementation

### Location
All development scripts are in `scripts/` directory:
- `scripts/validate.ts` - Setup validation
- `scripts/analyze.ts` - Codebase analysis  
- `scripts/quality.ts` - Quality assessment

### Dependencies
Scripts use these tools:
- `ts-morph` - TypeScript AST analysis
- `tsx` - TypeScript execution
- Node.js built-in modules

### Integration
Scripts integrate with:
- Package.json scripts
- CI/CD pipelines
- Development workflow
- Code review process