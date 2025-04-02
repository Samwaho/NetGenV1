import strawberry
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter
from app.config.database import connect_to_database, close_database_connection
from app.config.settings import settings
from app.config.deps import get_context
from app.resolvers.auth import AuthResolver
from app.resolvers.organization import OrganizationResolver
from app.resolvers.plan import PlanResolver


@strawberry.type
class Query(AuthResolver, OrganizationResolver, PlanResolver):
    pass

@strawberry.type
class Mutation(AuthResolver, OrganizationResolver, PlanResolver):
    pass

schema = strawberry.Schema(query=Query, mutation=Mutation)

graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context
)

app = FastAPI(title="Your API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GraphQL endpoint
app.include_router(graphql_app, prefix="/graphql")

@app.on_event("startup")
async def startup_db_client():
    """Connect to MongoDB on startup"""
    await connect_to_database()

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    await close_database_connection()
