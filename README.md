# Lighthouse

A lightweight, unified dashboard for managing Docker Compose stacks, monitoring servers, and documenting your self-hosted infrastructure.

Lighthouse is a stripped-down fork of **Portainer Community Edition**, rebuilt for simplicity, speed, and focus.  
It combines the essential parts of Portainer with built-in Compose editing, server monitoring, port tracking, and documentation — all in one clear interface.

---

## Key Features

### Compose Management
- View, edit, and deploy **Docker Compose** projects directly from the web interface.
- Create new Compose stacks with the **"New Project"** function, which:
  - Generates a folder under your server’s projects root.
  - Initializes a `docker-compose.yml` file ready to edit.
- Inline **YAML editor** with:
  - Compose schema validation.
  - Auto-complete for services, ports, networks, and volumes.
  - Live syntax checking and linting.
- Validate, dry-run, and deploy directly from the editor.
- Optional Git versioning of projects for diffs and rollback.

---

### Server Monitoring
- Lightweight monitoring of all connected servers.
- Real-time statistics: CPU, memory, disk, and network usage.
- Uptime and resource summaries per server.
- No heavy Prometheus/Grafana stack required; includes a simple built-in metrics agent.

---

### Multi-Server Management
- Connect multiple Docker hosts and manage them all from one dashboard.
- View running containers, stack health, and compose projects across environments.
- Centralized overview of container counts, resource usage, and alerts.

---

### Port Tracker (PortNote-Inspired)
- Automatically list all ports in use by Docker containers.
- Detect port collisions before deployment.
- Add notes or labels to ports (for example, `8080 → nginx proxy`, `5432 → dev database`).
- Export and search ports across all servers.

---

### Documentation Hub
- Built-in markdown documentation section per project.
- Ideal for recording setup steps, credentials, update guides, and operational notes.
- Searchable and linkable from the main dashboard.

---

### Unified Dashboard
- A home screen with tiles for key services such as Plex, Gitea, or Nextcloud.
- Quick-launch links with health indicators.
- Optional shortcuts to non-Docker services or remote URLs.

---

## Technical Overview

### Architecture
- Core: Go (inherits and simplifies Portainer CE).
- Frontend: Modernized web UI (React or Vue preferred).
- Storage: Lightweight embedded database (SQLite or BoltDB).
- Metrics Agent: Go binary running on each connected server.
- Compose Support: Compatible with Docker Compose v2.

### Server Agent
Each connected server runs a small agent that:
- Communicates with the Docker socket.
- Manages project folders under `/srv/lighthouse` (configurable).
- Reports metrics and ports in use.
- Handles file creation and Compose operations securely.

---

## File Management
All Compose projects live under the server’s configured root directory.  
Lighthouse prevents path escapes and uses secure permissions (`0700` for directories and `0600` for files).

Example structure:
