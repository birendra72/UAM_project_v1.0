# Project Overview: Web_UAM_v1.0

This document outlines all the functionalities and features currently shown in the Project Overview page of the Web_UAM_v1.0 application. It includes both implemented and unimplemented features, providing a comprehensive view of the operations users can perform on datasets within a project.

## Overview
The Project Overview page is accessible at `/app/projects/{projectId}` and provides a centralized interface for managing datasets, exploring data, training models, making predictions, and exporting results. The page is divided into tabs for different operational categories.

## Key Features and Functionalities

### 1. Project Header
- **Project Name and ID Display**: Shows the project's name and unique ID.
- **Navigation**: Back button to return to the projects list.
- **Export Button**: Placeholder for exporting the entire project (not implemented).

### 2. Statistics Cards
- **Datasets Count**: Displays the number of datasets linked to the project.
- **Total Rows**: Aggregates and displays the total number of rows across all project datasets.
- **Models Count**: Shows the number of trained models (currently always 0, as model training frontend is not implemented).
- **Status**: Indicates project status as "Active" if datasets are present, otherwise "Setup".

### 3. Data Tab (Fully Implemented)
This tab handles dataset management within the project.

#### Implementation Process:
- **Frontend**: Built with React components using React Dropzone for file uploads, React Query for state management, and custom UI components.
- **Backend**: FastAPI endpoints for dataset upload, linking/unlinking, and preview. Files stored in local storage with metadata in SQLite database.
- **File Handling**: Supports CSV, Excel, JSON, Parquet formats. Files are parsed to extract row/column counts and stored securely.

#### Upload Dataset
- **Drag & Drop Interface**: Users can drag and drop dataset files directly onto the upload area.
- **File Browser**: Click to browse and select files from the local system.
- **Supported Formats**: CSV, Excel (.xlsx, .xls), JSON, Parquet.
- **Upload Process**: Files are uploaded to the server via `/api/datasets/upload`, and the project datasets list is refreshed upon success.
- **Error Handling**: Displays toast notifications for upload success or failure.

#### Project Datasets List
- **Dataset Cards**: Each dataset is displayed in a card format showing:
  - Dataset icon
  - Filename (truncated if long)
  - File size
  - Number of rows and columns
- **Preview Functionality**: Button to preview dataset contents in a modal (implemented via DatasetPreviewModal component using `/api/datasets/{id}/preview`).
- **Unlink Dataset**: Button to remove the dataset from the project (updates both project and global dataset lists via DELETE `/api/datasets/link/{datasetId}/{projectId}`).

#### Link Existing Datasets
- **Available Datasets List**: Displays all user-uploaded datasets not yet linked to the current project.
- **Dataset Cards**: Similar to project datasets, showing filename, size, rows, columns.
- **Preview Functionality**: Same as project datasets.
- **Link Dataset**: Button to associate the dataset with the project (updates lists accordingly via POST `/api/datasets/link/{datasetId}/{projectId}`).

### 4. Explore Tab (Partially Implemented)
This tab provides data exploration and automated insights using Exploratory Data Analysis (EDA).

#### Implementation Process:
- **Backend EDA**: Implemented in `/api/analysis/eda` endpoint, runs synchronously to generate summary statistics and interactive Plotly charts. Uses pandas for data processing and stores artifacts (JSON summaries and chart data) in storage.
- **Frontend Visualization**: DataVisualization component fetches EDA results, displays statistics cards, and renders interactive charts using Plotly.js. Includes custom chart generator for histograms, box plots, and scatter plots.
- **Data Flow**: User selects dataset → Calls startEDA API → Polls for status → Loads summary and chart artifacts → Displays visualizations.

#### Automated Insights
- **EDA Generation**: Button to trigger automated EDA on selected dataset, showing progress and status.
- **Statistics Display**: Cards showing total rows, columns, missing values, and data completeness percentage.
- **Interactive Charts**: Plotly-based histogram of first numeric column.
- **Custom Chart Generator**: Dropdown selectors for columns and chart types (histogram, box plot, scatter plot).

#### Current Limitations:
- Only generates histogram for first numeric column automatically.
- Custom charts require manual column selection.
- No correlation analysis or advanced profiling yet.

### 5. Models Tab (Backend Implemented, Frontend Placeholder)
This tab is for machine learning model training and management.

#### Implementation Process:
- **Backend Training**: Implemented via Celery tasks (`train_models`) that preprocess data, train simple LinearRegression models on numeric columns, and save models as joblib files. Accessible through `/api/models/train` endpoint.
- **Model Storage**: Trained models stored as artifacts with metadata in database.
- **Frontend**: Currently shows placeholder message, no UI for training configuration or model management.

#### Current State:
- Backend can train basic linear regression models.
- Models are saved and can be listed via `/api/models/`.
- Frontend displays placeholder message prompting to upload dataset.

#### Planned Features (Not Implemented):
- Model selection UI (regression, classification, etc.)
- Training configuration interface (hyperparameters, algorithms)
- Model performance metrics display (accuracy, precision, recall, etc.)
- Model comparison and selection
- Model versioning

### 6. Predict Tab (Backend Implemented, Frontend Placeholder)
This tab is for making predictions using trained models.

#### Implementation Process:
- **Backend Prediction**: Implemented in `/api/models/{model_id}/predict` endpoint, loads model from storage using joblib, processes input DataFrame, and returns predictions.
- **Frontend**: Currently shows placeholder message.

#### Current State:
- Backend supports prediction on trained models.
- Accepts JSON input data and returns prediction arrays.

#### Planned Features (Not Implemented):
- Prediction input interface
- Model selection dropdown
- Batch prediction capabilities
- Prediction results display with confidence scores

### 7. Export Tab (Backend Implemented, Frontend Placeholder)
This tab is for exporting results and generating reports.

#### Implementation Process:
- **Backend Reports**: Implemented via Celery `finalize_run` task that generates PDF reports using ReportLab. Reports stored as artifacts accessible via `/api/reports/generate`.
- **Artifact Downloads**: All run artifacts (models, reports, cleaned datasets) can be downloaded via presigned URLs.

#### Current State:
- Backend generates PDF reports automatically after model training.
- All artifacts are downloadable.

#### Planned Features (Not Implemented):
- Export UI for datasets in various formats
- Export model predictions
- Custom report generation interface
- Scheduled exports
- Data export with filters

## Technical Implementation Notes
- **Frontend Framework**: React with TypeScript, using Vite as the build tool.
- **UI Components**: Custom UI components built on top of Radix UI and Tailwind CSS.
- **State Management**: React Query (TanStack Query) for server state management.
- **File Upload**: React Dropzone for drag-and-drop functionality.
- **API Integration**: Custom API client for backend communication.
- **Backend**: FastAPI-based backend with dataset storage and management.
- **Database**: SQLite with SQLAlchemy ORM.

## Current Implementation Status
- **Fully Implemented**: Data tab functionality (upload, link/unlink, preview).
- **Partially Implemented**: Explore tab (EDA backend and basic visualization frontend).
- **Backend Implemented, Frontend Placeholder**: Models tab (training via API), Predict tab (prediction API), Export tab (report generation).
- **Not Implemented**: Advanced visualization features, model training UI, prediction UI, export UI.
- **Partially Implemented**: Statistics cards (models count always 0 due to frontend limitation, export button non-functional).

## Functionality Remaining
### High Priority
1. **Models Tab Frontend**: Implement UI for model training configuration, model selection, and performance metrics display.
2. **Predict Tab Frontend**: Build prediction input interface, model selection, and results display.
3. **Export Tab Frontend**: Create UI for dataset export, custom report generation, and artifact downloads.

### Medium Priority
4. **Explore Tab Enhancements**: Add correlation analysis, advanced profiling, and more chart types.
5. **Statistics Cards**: Connect models count to actual trained models, implement export functionality.
6. **Real-time Updates**: Add WebSocket or polling for live progress updates during long-running tasks.

### Low Priority
7. **Advanced Features**: Automated model selection, feature engineering, hyperparameter tuning.
8. **Additional Visualizations**: Heatmaps, advanced scatter plots, time series analysis.
9. **Batch Operations**: Bulk dataset processing, batch predictions, scheduled exports.

This overview serves as a roadmap for completing the remaining functionalities and enhancing the project's data analysis capabilities.
