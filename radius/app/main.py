from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router
from app.config.database import connect_to_database, close_database_connection
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("radius_api")

# Create FastAPI app
app = FastAPI(
    title="FreeRADIUS REST API",
    description="REST API for FreeRADIUS realm_rest module",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modify in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"Request: {request.method} {request.url.path} - Completed in {process_time:.4f}s")
    return response

# Include API routes
app.include_router(router)

# Startup and shutdown events
@app.on_event("startup")
async def startup_db_client():
    await connect_to_database()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_database_connection()

# Root endpoint for health check
@app.get("/")
async def root():
    return {
        "message": "FreeRADIUS REST API is running",
        "docs": "/docs",
        "status": "/api/radius/status"
    }

