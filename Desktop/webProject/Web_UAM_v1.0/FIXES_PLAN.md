# Universal Analyst Model (UAM) - Critical Fixes Implementation Plan

## Overview
After comprehensive analysis of the UAM project, several critical issues have been identified that prevent the application from functioning properly. This document outlines the fixes needed to make all features work correctly.

## Critical Issues Identified

### 1. Missing API Endpoints in Backend
The frontend makes calls to several API endpoints that don't exist in the backend:

#### Reports API (app/routers/reports.py)
- `getProjectReports` (frontend calls `/api/reports/projects/{projectId}/reports`)
- `generateProjectReport` (frontend calls `/api/reports/projects/{projectId}/generate`)
- `getReportDownloadUrl` (frontend calls `/api/reports/{artifactId}/download`)

#### Models API (app/routers/models.py)
- `getProjectModels` (frontend calls `/api/analysis/projects/{projectId}/ml/models`)

#### Analysis API (app/routers/analysis.py)
- `analyzeTaskType` (frontend calls `/api/analysis/projects/{projectId}/analyze-task-type`)
- `generateEDA` (frontend calls `/api/analysis/projects/{projectId}/generate-eda`)

### 2. Incomplete Database Models
- `DatasetVersion` model has syntax error in foreign key reference
- Missing relationships and constraints

### 3. Missing Service Methods
- `MLService.generate_prediction_summary` method is called but not implemented
- `MLService.explain_predictions` method is called but not implemented

### 4. Frontend-Backend API Mismatch
- API endpoint paths don't match between frontend and backend
- Request/response schemas don't align

## Implementation Plan

### Phase 1: Fix Critical Backend API Endpoints

#### 1.1 Fix Reports Router (`app/routers/reports.py`)
**Current Issues:**
- Missing `list_project_reports` endpoint (should be `getProjectReports`)
- Missing `generate_project_report` endpoint (should be `generateProjectReport`)
- Missing `get_report_download_url` endpoint (should be `getReportDownloadUrl`)

**Fixes Needed:**
```python
# Add missing endpoints
@router.get("/projects/{project_id}/reports")
def getProjectReports(project_id: str, ...):  # Rename from list_project_reports

@router.post("/projects/{project_id}/generate")
def generateProjectReport(project_id: str, ...):  # Rename from generate_project_report

@router.get("/{artifact_id}/download")
def getReportDownloadUrl(artifact_id: str, ...):  # Rename from get_report_download_url
```

#### 1.2 Fix Models Router (`app/routers/models.py`)
**Current Issues:**
- Missing `getProjectModels` endpoint

**Fixes Needed:**
```python
@router.get("/projects/{project_id}/models")
def getProjectModels(project_id: str, ...):
    # Implementation to get models for a project
```

#### 1.3 Fix Analysis Router (`app/routers/analysis.py`)
**Current Issues:**
- Missing `analyzeTaskType` endpoint
- Missing `generateEDA` endpoint

**Fixes Needed:**
```python
@router.post("/projects/{project_id}/analyze-task-type")
def analyzeTaskType(project_id: str, ...):

@router.post("/projects/{project_id}/generate-eda")
def generateEDA(project_id: str, ...):
```

### Phase 2: Fix Database Models

#### 2.1 Fix DatasetVersion Model (`app/db/models.py`)
**Current Issue:**
```python
dataset_versions

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id: Mapped[str] = mapped_column(String, ForeignKey("datasets.NaNe: Mapped[str] = mapped_column(String, nullable=False)
```

**Fix:**
```python
class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id: Mapped[str] = mapped_column(String, ForeignKey("datasets.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    metrics_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    version: Mapped[str | None] = mapped_column(String)
```

### Phase 3: Implement Missing Service Methods

#### 3.1 Add Missing MLService Methods (`app/services/ml_service.py`)
**Missing Methods:**
- `generate_prediction_summary`
- `explain_predictions`

**Implementation:**
```python
@staticmethod
def generate_prediction_summary(predictions: np.ndarray) -> dict:
    # Implementation

@staticmethod
def explain_predictions(model_meta, datasets, input_data, method="lime") -> dict:
    # Implementation
```

### Phase 4: Fix API Path Mismatches

#### 4.1 Update Frontend API Calls (`FrontEnd/src/lib/api.ts`)
**Current Issues:**
- Paths don't match backend endpoints
- Some endpoints are called with wrong HTTP methods

**Fixes:**
```typescript
// Fix report endpoints
getProjectReports(projectId: string): Promise<...>
generateProjectReport(projectId: string, ...): Promise<...>
getReportDownloadUrl(artifactId: string): Promise<...>

// Fix model endpoints
getProjectModels(projectId: string): Promise<...>

// Fix analysis endpoints
analyzeTaskType(projectId: string, ...): Promise<...>
generateEDA(projectId: string, ...): Promise<...>
```

### Phase 5: Update Schemas and Models

#### 5.1 Fix Pydantic Schemas (`app/schemas/`)
**Missing/Incomplete Schemas:**
- Report-related schemas
- Prediction-related schemas
- Analysis-related schemas

#### 5.2 Update Database Relationships
**Add missing foreign key relationships and constraints**

### Phase 6: Testing and Validation

#### 6.1 Test All Endpoints
- Test each fixed endpoint with proper requests
- Validate responses match frontend expectations

#### 6.2 Integration Testing
- Test complete workflows (upload -> analyze -> train -> predict -> export)
- Validate data flows between components

## Priority Order

1. **High Priority** (Breaking functionality):
   - Fix missing API endpoints
   - Fix database model syntax errors
   - Implement missing service methods

2. **Medium Priority** (Feature completion):
   - Fix API path mismatches
   - Update schemas and models
   - Add proper error handling

3. **Low Priority** (Enhancements):
   - Add comprehensive logging
   - Optimize performance
   - Add additional validation

## Success Criteria

- All frontend API calls have corresponding backend implementations
- No 404 or 500 errors on API calls
- Data flows correctly through all components
- All tabs in ProjectOverview work end-to-end
- Database operations work without syntax errors
- Models can be trained, predictions made, and reports generated

## Timeline Estimate

- Phase 1: 2-3 days (critical fixes)
- Phase 2: 1 day (database fixes)
- Phase 3: 2 days (service implementations)
- Phase 4: 1 day (API alignment)
- Phase 5: 1 day (schema updates)
- Phase 6: 2 days (testing and validation)

Total: ~8-10 days for complete implementation
