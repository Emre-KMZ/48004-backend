# MiniStore

A full-stack e-commerce application powered by Django (Backend), React/Vite (Frontend), and Minio (S3-compatible Media Storage).

## 🐳 Quick Start with Docker (Recommended)

The easiest way to run the entire application stack is by using Docker. This ensures that the frontend, backend, database, and media storage perfectly match the required environment.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed and running.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

### 1. Build and Start the Containers

From the root directory of the project, run the following command to build the images and start the services in the background:

```bash
docker-compose up -d --build
```

This will spin up three containers:
- **`ministore-backend`**: The Django API server running on port `8000`.
- **`ministore-frontend`**: The React Vite application running on port `5173`.
- **`ministore-minio`**: The Minio media storage server running on port `9000` (UI on `9001`).

### 2. Seed the Database & Media Bucket

On a fresh clone, you need to populate the database with the core products and upload their respective images into the Minio storage bucket. 

Run the reset command inside the running backend container:

```bash
docker-compose exec backend python manage.py reset_state
```

This command will:
1. Apply database migrations.
2. Load the system fixture data (17 default products, categories, and users).
3. Automatically configure the Minio bucket and upload all high-quality placeholder images.

### 3. Access the Application

Once the containers are running and seeded, you can access the application here:

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Django Admin API**: [http://localhost:8000/admin](http://localhost:8000/admin)
- **Minio Storage Console**: [http://localhost:9001](http://localhost:9001) *(Login: `minioadmin` / `minioadminpassword`)*

### 4. Stopping the Services

To stop the development servers without destroying your database and media volume data:

```bash
docker-compose stop
```

To completely tear down the environment (including destroying the database and media buckets):

```bash
docker-compose down -v
```
