# Universal Analyst Model (UAM)
## State Persistence Strategy (Hybrid URL + Context Model)

This document defines the state persistence and management strategy for the **Universal Analyst Model (UAM)** web application.  
The goal is to ensure **seamless user experience**, **context continuity**, and **sharable navigation** between all analytical tabs and dashboards.

---

## 🧩 Overview
UAM adopts a **Hybrid Persistence Architecture** that combines:

- **URL-based persistence** → For navigation, tabs, and project-level states.  
- **In-memory / session-based persistence** → For temporary, sensitive, or high-frequency interactions.

This ensures users can refresh, navigate, or share links without losing context while maintaining performance and security.

---

## ⚙️ URL-Based Persistence

### Use Cases
- Navigation between **projects, datasets, and tabs**
- Persistent query parameters for filters, pagination, and views
- Bookmarkable and shareable links

### Implementation Example (React Router v6)
```tsx
import { useParams, useSearchParams } from "react-router-dom";

function ProjectOverview() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "data";

  const handleTabChange = (newTab) => {
    setSearchParams({ tab: newTab });
  };

  return (
    <Tabs activeKey={tab} onChange={handleTabChange}>
      <TabPane key="data" tab="Data">Data Content</TabPane>
      <TabPane key="eda" tab="EDA">EDA Content</TabPane>
      <TabPane key="models" tab="Models">Model Content</TabPane>
    </Tabs>
  );
}
```

### Benefits
- Supports **deep linking** (e.g., `/app/projects/123?tab=models`)
- Retains tab state after page reload or navigation
- Enables **multi-tab** workflows

---

## 🧠 In-Memory (Context / State Management)

### Use Cases
- Temporary or sensitive data (uploaded files, training sessions)
- UI preferences (active chart, expanded panel, sort order)
- Optimistic updates and caching (React Query)
- Temporary results not yet persisted to backend

### Implementation Example
```tsx
import { createContext, useContext, useState } from "react";

const ProjectContext = createContext(null);

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }) {
  const [currentProject, setCurrentProject] = useState(null);
  const [activeDataset, setActiveDataset] = useState(null);

  return (
    <ProjectContext.Provider value={{ currentProject, setCurrentProject, activeDataset, setActiveDataset }}>
      {children}
    </ProjectContext.Provider>
  );
}
```

---

## 💾 Session & Local Storage

### Use Cases
- Persist data temporarily between sessions or reloads.
- Maintain user’s last viewed tab or selected project.
- Ensure smooth return after login or session expiry.

### Example
```tsx
useEffect(() => {
  const lastProject = sessionStorage.getItem("last_project");
  if (lastProject) setCurrentProject(JSON.parse(lastProject));
}, []);

useEffect(() => {
  if (currentProject) {
    sessionStorage.setItem("last_project", JSON.stringify(currentProject));
  }
}, [currentProject]);
```

---

## 🔄 Synchronizing URL + Context

To keep both systems in sync, use libraries like:
- **use-query-params** (`npm install use-query-params`)
- **Zustand** with middleware (`persist` and `subscribeWithSelector`)
- **TanStack Query** for async state and API caching

Example with Zustand:
```tsx
import create from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(persist(
  (set) => ({
    tab: "data",
    setTab: (tab) => set({ tab }),
  }),
  { name: "uam-app-state" }
));
```

---

## 🔐 Security Considerations
- Do not store **JWT tokens** or **personal data** in URLs.
- Use **HTTP-only cookies** or secure headers for authentication.
- Encrypt any stored user-sensitive data (e.g., dataset paths).

---

## ✅ Recommended Best Practices
1. Use **React Router v6** with `useSearchParams` for URL-based state.
2. Manage async data and caching with **TanStack Query**.
3. Use **Zustand** or **React Context** for global session state.
4. Persist small session info (like last project or tab) in `sessionStorage`.
5. Ensure all backend endpoints are idempotent to support reload-based persistence.

---

## 🧭 Summary

| Layer | State Method | Persistence | Example |
|--------|---------------|-------------|----------|
| Navigation | URL Parameters | Long-term | `/app/projects/12?tab=eda` |
| Active UI Context | React Context | Session | Current project, active dataset |
| Temporary Data | Memory | Transient | Uploaded file previews |
| Cached API Data | React Query | Session | EDA results, charts |
| Session Info | sessionStorage | Short-term | Last opened project |

---

> With this hybrid model, the UAM frontend achieves **stability, shareability, and interactivity** — empowering users to navigate complex workflows seamlessly while preserving analytical context.
