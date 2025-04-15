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
from app.resolvers.subscription import SubscriptionResolver
from app.resolvers.activity import ActivityResolver
from app.resolvers.isp_station import ISPStationResolver
from app.resolvers.isp_package import ISPPackageResolver
from app.resolvers.isp_customer import ISPCustomerResolver
from app.resolvers.isp_inventory import ISPInventoryResolver
from app.resolvers.isp_ticket import ISPTicketResolver
from app.resolvers.isp_customers_accounting import ISPCustomerAccountingResolver

@strawberry.type
class Query(
    AuthResolver, 
    OrganizationResolver, 
    PlanResolver, 
    SubscriptionResolver,
    ActivityResolver,
    ISPStationResolver,
    ISPPackageResolver,
    ISPCustomerResolver,
    ISPInventoryResolver,
    ISPTicketResolver,
    ISPCustomerAccountingResolver
):
    pass

@strawberry.type
class Mutation(
    AuthResolver, 
    OrganizationResolver, 
    PlanResolver, 
    SubscriptionResolver,
    ActivityResolver,
    ISPStationResolver,
    ISPPackageResolver,
    ISPCustomerResolver,
    ISPInventoryResolver,
    ISPTicketResolver,
    ISPCustomerAccountingResolver
):
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
