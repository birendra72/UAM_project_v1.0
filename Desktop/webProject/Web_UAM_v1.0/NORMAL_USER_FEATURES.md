# Normal User Features Structure

## Overview
This document outlines the features available to normal (applicant) users after authentication. Users access the main application via `/app/dashboard` and can perform data analysis workflows including managing datasets, creating projects, training models, and generating insights.

### Templates Feature
- **Current Implementation**: Static grid of 4 hardcoded templates (Sales Forecasting, Customer Segmentation, Market Basket Analysis, Churn Prediction) with categories, difficulty levels, and "Use Template" buttons (non-functional).
- **Motive**: Templates are designed to democratize data analysis by providing pre-built, customizable workflows for common business problems. This reduces the technical barrier for non-expert users, accelerates project setup, and ensures best practices are followed. By offering templates for use cases like sales forecasting or customer segmentation, we enable users to start analyzing data immediately without deep ML knowledge, while still allowing customization for advanced users.
- **Dynamic Plan**: Fetch templates from API, functional "Use Template" to auto-create projects with pre-configured settings, template customization options, user-created template sharing.

## Current Static Implementations

### Dashboard (`/app/dashboard`)
#### Hardcoded Elements
- Statistics cards: Active Projects (12), Datasets (28), Trained Models (45), Success Rate (94%) with icons.
- Recent Projects list: 3 static projects (e.g., "Sales Forecast Q4" with dataset "retail_sales.csv", status "Active", updated "2 hours ago").
- Pro Tip card: Static promotional content linking to templates.

#### Empty/Non-Functional Parts
- No real-time data fetching from API for stats or projects.
- No user-specific statistics or dynamic updates.
- Quick Actions buttons are static links without backend integration.
- No dynamic interactions or real-time notifications.

### Projects (`/app/projects`)
#### Hardcoded Elements
- Progress bars: Placeholder progress bars hardcoded to 0% for all projects.

#### Empty/Non-Functional Parts
- No create, edit, or delete actions for projects.
- Progress not dynamic or fetched from backend.
- No project creation flow or form.
- Search filtering by name is functional, but no additional filters.

### Datasets (`/app/datasets`)
#### Hardcoded Elements
- None identified (data is fetched from API).

#### Empty/Non-Functional Parts
- Upload button: Non-functional, no file upload capability.
- No delete or edit actions for datasets.
- No preview of dataset contents or metadata details beyond filename, rows, columns.
- Search filtering by filename is functional, but no additional filters.

### Models (`/app/models`)
#### Hardcoded Elements
- None identified (data is fetched from API).

#### Empty/Non-Functional Parts
- Search input: Non-functional, no search capability.
- MoreVertical button: Non-functional, no actions menu.
- No model details view or retraining functionality.
- No additional filters or sorting options.

### Project Overview (`/app/projects/:id/overview`)
#### Hardcoded Elements
- Project stats cards: Data Quality, Insights, Best Model, Status with static values.
- Data tab: Static dataset info (no dynamic data preview).

#### Empty/Non-Functional Parts
- Explore tab: Placeholder, no charts or visualizations.
- Models tab: Placeholder, no model training interface.
- Predict tab: Placeholder, no prediction tools.
- Export tab: Placeholder, no export functionality.
- No dynamic project data or real insights.

## Dynamic Conversion Plan

### Dashboard Enhancements
- **Real Stats**: Fetch user-specific counts from API (projects, datasets, models).
- **Recent Projects**: Dynamic list from API with real update times and statuses.
- **Interactions**: Clickable stats to navigate to respective pages, real-time updates via WebSocket/polling.

### Projects Management
- **CRUD Operations**: Create new projects (form with name, description, dataset selection), edit/delete existing.
- **Progress Tracking**: Real progress from backend (e.g., training status), visual progress bars.
- **Project Creation Flow**: Step-by-step wizard for dataset upload, template selection, initial setup.

### Datasets Management
- **Upload Functionality**: File upload with drag-drop, validation (CSV/Excel), preview table.
- **Dataset Actions**: View details, edit metadata, delete, preview data samples.
- **Integration**: Link datasets to projects, track usage across models.

### Models Management
- **Model Details**: View training logs, performance metrics, confusion matrices.
- **Actions**: Retrain, export, compare models, delete.
- **Search/Filter**: Functional search by name/type, filter by project/accuracy.

### Project Analysis Workflow
- **Data Tab**: Interactive data preview, column selection, basic stats.
- **Explore Tab**: Charts/visualizations (histograms, correlations), automated insights.
- **Models Tab**: Model training interface (algorithm selection, hyperparameters), training progress, results.
- **Predict Tab**: Input forms for predictions, batch prediction uploads, results display.
- **Export Tab**: Download reports (PDF/CSV), export models, shareable links.

## Overall Features Structure

### Core Workflow
1. **Onboarding**: Dashboard overview with quick stats and recent activity.
2. **Data Preparation**: Upload/manage datasets with validation and preview.
3. **Project Creation**: Set up analysis projects with dataset selection and templates.
4. **Exploratory Analysis**: Visualize data, generate insights, identify patterns.
5. **Model Training**: Train ML models with various algorithms, monitor progress.
6. **Prediction**: Make predictions on new data using trained models.
7. **Reporting**: Export results, generate reports, share insights.

### Supporting Features
- **Templates**: Pre-built analysis templates for common use cases (e.g., sales forecast, customer segmentation).
- **Settings**: User preferences, API keys, notification settings.
- **Notifications**: Real-time updates on training completion, errors.

## Next Implementation Steps/Roadmap

### Phase 1: Core CRUD (Priority: High)
- Implement dataset upload with file handling and validation.
- Add project creation form with dataset selection.
- Enable basic model training (single algorithm, default params).
- Connect dashboard stats to real API data.

### Phase 2: Analysis Features (Priority: High)
- Build data exploration interface (charts, stats).
- Implement model training UI with progress tracking.
- Add prediction interface for trained models.

### Phase 3: Advanced Features (Priority: Medium)
- Multi-model comparison and selection.
- Batch predictions and automated workflows.
- Export/reporting functionality.

### Phase 4: Polish & Optimization (Priority: Low)
- Real-time notifications and WebSocket updates.
- Advanced search/filtering across all entities.
- Performance optimizations for large datasets.

### Technical Considerations
- **State Management**: Use React Query for server state, Context/Zustand for client state.
- **API Integration**: Ensure all endpoints in backend routers are fully utilized.
- **Error Handling**: Comprehensive error states and user feedback.
- **Testing**: Unit tests for components, integration tests for workflows.
