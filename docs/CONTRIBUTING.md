# Contributing to India Procurement Watch (IPW)

Thank you for your interest in improving IPW! The project thrives on community contributions to enhance our analytics, flag new corruption indicators, and streamline our AI pipeline.

## 1. Project Structure

As of v6.0, the codebase is strictly separated to enforce clean architecture:

*   **`frontend/`**: Contains the React + Vite frontend. All components, styling, and UI logic live here.
*   **`backend/api/`**: Contains the Flask backend. 
    *   **`routes/`**: Flask Blueprints for specific API endpoints (e.g., `kpi.py`, `trends.py`).
    *   **`core/`**: Utility modules for database connections (`db.py`) and caching (`cache.py`).
*   **`docs/`**: Master documentation and technical guides.

## 2. Development Guidelines

### Frontend (React/Vite)
*   **Component Modularity:** Ensure new UI widgets are built as modular React components in `frontend/src/components/`.
*   **Code Splitting:** If you are adding a completely new Page, remember to add it to the Lazy Loading imports in `App.jsx` to maintain our fast load times.
*   **Styling:** We use pure CSS. Place your styles in `index.css` or component-specific CSS files.

### Backend (Flask/Python)
*   **Blueprint Architecture:** Do **not** add new endpoints directly to `app.py`. If you are creating a new feature, place it in an existing Blueprint in `backend/api/routes/` or create a new one.
*   **Database Connections:** Always import `get_pg_conn()` from `core.db` to handle PostgreSQL queries. This ensures connections are correctly request-scoped and closed.
*   **Caching:** Decorate heavy aggregation endpoints with `@cache.cached(timeout=300)` from `core.cache` to protect the database from excessive load.

## 3. Creating a Pull Request (PR)

1. **Fork the Repository:** Create your own fork and clone it locally.
2. **Create a Feature Branch:** `git checkout -b feature/your-feature-name`
3. **Commit your changes:** Use clear, descriptive commit messages.
4. **Push to the branch:** `git push origin feature/your-feature-name`
5. **Open a PR:** Go to the GitHub repository and submit a Pull Request. Provide a detailed explanation of what your code does, why it is needed, and any potential side effects.

## 4. Conduct

*   We do not tolerate harassment of any kind. 
*   Remember that this tool analyzes public data. Do not submit PRs that attempt to obfuscate data or introduce backdoors. Transparency is our core value.

Thank you for helping us maintain public accountability!
