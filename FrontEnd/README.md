# Universal Analyst Model (UAM)

## Overview

Universal Analyst Model (UAM) is a comprehensive AI-powered data analytics platform designed to democratize data science. The platform provides intelligent data cleaning, automated exploratory data analysis (EDA), guided machine learning workflows, and collaborative project management. UAM serves as a universal analyst system with distinct interfaces for end users, project collaboration, data repositories, and administrative control.


## Frontend Routes

### Public Pages

| Route | Path | Description |
|-------|------|-------------|
| Home | `/` | Landing page with platform overview and feature highlights |
| Solutions | `/solutions` | Detailed breakdown of platform capabilities and use cases |
| Pricing | `/pricing` | Subscription plans and pricing information |
| Templates | `/templates` | Gallery of smart analysis templates available to users |
| Demo | `/demo` | Interactive demo with sample dataset for trial |
| About | `/about` | Company mission, vision, values, and team information |
| Contact | `/contact` | Contact form and support information |
| Login | `/login` | User authentication page |
| Register | `/register` | New user registration page |
| Forgot Password | `/forgot-password` | Password recovery page |
| Privacy Policy | `/privacy` | Privacy policy and data handling information |
| Terms of Service | `/terms` | Terms and conditions of platform use |

### User Application (Protected Routes)

| Route | Path | Description |
|-------|------|-------------|
| User Dashboard | `/app/dashboard` | User command center with project overview and quick actions |
| Projects | `/app/projects` | Manage and view all analysis projects |
| Project Overview | `/app/projects/:projectId/overview` | Detailed project workspace with tabbed interface |
| Dataset Repository | `/app/datasets` | Browse, upload, and manage datasets |
| Model Repository | `/app/models` | View saved models and training history |
| Template Browser | `/app/templates` | Browse and apply pre-built analysis templates |
| User Settings | `/app/settings` | Profile management, security settings, and preferences |

#### Project Workspace Tabs
The Project Overview (`/app/projects/:projectId/overview`) contains a tabbed interface with:
- **Data Tab**: Dataset viewing, cleaning, and transformation
- **Explore Tab**: Automated EDA with visualizations and insights
- **Models Tab**: Model selection, training, and hyperparameter tuning
- **Predict Tab**: Make predictions using trained models
- **Export Tab**: Export results, reports, and trained models

### Admin Dashboard (Protected Routes)

| Route | Path | Description |
|-------|------|-------------|
| Admin Dashboard | `/admin/dashboard` | Control panel with platform overview and key metrics |
| User Management | `/admin/users` | View, manage, and moderate user accounts |
| Template Management | `/admin/templates` | Create, edit, and publish analysis templates |
| Analytics | `/admin/analytics` | Platform usage statistics and growth insights |

---

## Backend Integration

The frontend application is designed to integrate with RESTful backend APIs. Below are the planned API endpoints and their integration points:

### Authentication APIs
| Endpoint | Method | Purpose | Frontend Integration |
|----------|--------|---------|---------------------|
| `/api/auth/register` | POST | User registration | Register page form submission |
| `/api/auth/login` | POST | User authentication | Login page form submission |
| `/api/auth/logout` | POST | User logout | Header logout button |
| `/api/auth/reset-password` | POST | Password reset request | Forgot Password page |
| `/api/auth/verify-email` | GET | Email verification | Email link redirect |

### Project Management APIs
| Endpoint | Method | Purpose | Frontend Integration |
|----------|--------|---------|---------------------|
| `/api/projects` | GET | List user projects | Projects page, Dashboard |
| `/api/projects` | POST | Create new project | Projects page creation form |
| `/api/projects/:id` | GET | Get project details | Project Overview page |
| `/api/projects/:id` | PUT | Update project | Project settings modal |
| `/api/projects/:id` | DELETE | Delete project | Project deletion confirmation |

### Data Management APIs
| Endpoint | Method | Purpose | Frontend Integration |
|----------|--------|---------|---------------------|
| `/api/datasets` | GET | List datasets | Dataset Repository page |
| `/api/datasets/upload` | POST | Upload new dataset | Data upload form (Data Tab) |
| `/api/datasets/:id` | GET | Get dataset details | Dataset preview and exploration |
| `/api/datasets/:id/clean` | POST | Data cleaning operations | Data Tab cleaning tools |
| `/api/datasets/:id/transform` | POST | Data transformation | Data Tab transformation tools |

### Analysis & Modeling APIs
| Endpoint | Method | Purpose | Frontend Integration |
|----------|--------|---------|---------------------|
| `/api/analysis/eda` | POST | Automated EDA | Explore Tab generation |
| `/api/models/train` | POST | Train ML model | Models Tab training form |
| `/api/models` | GET | List saved models | Model Repository page |
| `/api/models/:id/predict` | POST | Make predictions | Predict Tab inference |
| `/api/models/:id/metrics` | GET | Model performance | Models Tab metrics display |

### Template APIs
| Endpoint | Method | Purpose | Frontend Integration |
|----------|--------|---------|---------------------|
| `/api/templates` | GET | List templates | Template Browser (user & public) |
| `/api/templates/:id` | GET | Get template details | Template detail view |
| `/api/templates/:id/apply` | POST | Apply template to project | Template application modal |
| `/api/admin/templates` | POST | Create template | Admin template creation form |

### Export APIs
| Endpoint | Method | Purpose | Frontend Integration |
|----------|--------|---------|---------------------|
| `/api/export/report` | POST | Generate analysis report | Export Tab report generation |
| `/api/export/model` | GET | Download trained model | Export Tab model download |
| `/api/export/data` | GET | Export processed data | Export Tab data download |

### Admin APIs
| Endpoint | Method | Purpose | Frontend Integration |
|----------|--------|---------|---------------------|
| `/api/admin/users` | GET | List all users | Admin User Management |
| `/api/admin/users/:id` | PUT | Update user account | User edit modal |
| `/api/admin/analytics` | GET | Platform analytics | Admin Analytics dashboard |

### Data Flow
- **Forms**: All form submissions (login, register, project creation, data upload) will POST to respective API endpoints
- **Dashboards**: Dashboard and repository pages will fetch data via GET requests on component mount
- **Real-time Updates**: Project workspace tabs will poll or use WebSocket connections for long-running operations (training, EDA)
- **Navigation**: Protected routes will verify authentication status via API token validation

---

## Design System

The application implements a modern, professional design system with:
- **Color Palette**: Deep indigo/purple primary, electric blue accents
- **Typography**: Inter font family for clarity and professionalism
- **Components**: shadcn/ui component library with custom variants
- **Themes**: Light/Dark mode support with seamless switching
- **Animations**: Smooth fade-ins, scale effects, and hover transitions
- **Responsive Design**: Mobile-first approach with breakpoints for all devices
- **Accessibility**: WCAG 2.1 AA compliant with semantic HTML

---

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design tokens
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend (To Be Integrated)
The frontend is backend-agnostic and ready to connect with any RESTful API or GraphQL backend. Recommended technologies:
- Node.js/Express, Python/FastAPI, or Django REST Framework
- PostgreSQL or MongoDB for database
- Redis for caching and session management
- AWS S3 or similar for file storage
- ML libraries: scikit-learn, TensorFlow, PyTorch

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Git for version control

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd universal-analyst-model

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Development

```bash
# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Environment Variables
Create a `.env` file in the root directory for environment-specific configuration:

```env
# API Base URL (to be configured when backend is ready)
VITE_API_BASE_URL=http://localhost:3000/api

# Other configuration variables will be added as needed
```

**Note**: Backend API integration is pending. API endpoints listed in the Backend Integration section are placeholder specifications. Once the backend is developed, update the `VITE_API_BASE_URL` and implement the corresponding API client services.

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── AppLayout.tsx   # Main application layout
│   ├── AppSidebar.tsx  # Navigation sidebar
│   ├── PublicHeader.tsx
│   └── PublicFooter.tsx
├── pages/              # Page components
│   ├── public/         # Public-facing pages
│   ├── app/            # User application pages
│   └── admin/          # Admin dashboard pages
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── App.tsx             # Root component with routing
├── main.tsx            # Application entry point
└── index.css           # Global styles and design tokens
```

---

## Future Enhancements

### Phase 1: Backend Integration
- Connect frontend routes to RESTful backend APIs
- Implement authentication and authorization flow
- Enable real data fetching and state management
- Add WebSocket support for real-time updates

### Phase 2: Advanced Features
- **Real-time Collaboration**: Multi-user project collaboration with live updates
- **Advanced Visualizations**: Interactive 3D plots and custom visualization builder
- **Model Marketplace**: Community-contributed templates and models
- **Automated Insights**: AI-powered recommendations and anomaly detection
- **Notebook Integration**: Jupyter-like notebook interface within projects

### Phase 3: Enterprise Features
- **Role-Based Access Control (RBAC)**: Granular permissions and team management
- **Audit Logging**: Comprehensive activity tracking and compliance reporting
- **SSO Integration**: SAML, OAuth, and Active Directory support
- **Private Cloud Deployment**: On-premise and private cloud options
- **API Access**: Programmatic access for external integrations

### Phase 4: Scalability & Performance
- **Distributed Processing**: Support for large-scale datasets (>10GB)
- **GPU Acceleration**: Hardware acceleration for model training
- **Caching Layer**: Redis-based caching for improved performance
- **CDN Integration**: Global content delivery for faster load times

---

### Custom Domain
To connect a custom domain:
1. Navigate to **Project** → **Settings** → **Domains**
2. Click **Connect Domain**
3. Follow the DNS configuration instructions

### Global Deployment to Vercel
For global deployment using Vercel (recommended for free tier):

1. Go to [vercel.com](https://vercel.com) and create a free account
2. Connect your GitHub repository
3. Create a new project and select the FrontEnd directory
4. In project settings, add environment variable:
   - `VITE_API_BASE_URL`: Your backend URL (e.g., `https://your-project.up.railway.app`)
5. Deploy the frontend

### Self-Hosted Deployment
For self-hosted deployment on platforms like Vercel, Netlify, or AWS:

```bash
# Build the production bundle
npm run build

# The dist/ folder contains the production-ready files
# Deploy the dist/ folder to your hosting provider
```

**Environment Configuration**: Remember to set the `VITE_API_BASE_URL` environment variable to point to your production backend API.

---

## Contributing

We welcome contributions to improve UAM! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Follow the existing TypeScript and React patterns
- Use semantic HTML and ARIA attributes for accessibility
- Maintain the design system tokens defined in `index.css`
- Write meaningful commit messages

---

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---