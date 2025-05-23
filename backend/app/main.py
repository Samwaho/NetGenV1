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
from app.resolvers.isp_customer_payments import ISPCustomerPaymentResolver
from app.resolvers.isp_transactions import ISPTransactionResolver
from app.resolvers.sms import SMSResolver
from app.api import mpesa, sms
from app.tasks.scheduler import start_scheduler

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
    ISPCustomerAccountingResolver,
    ISPCustomerPaymentResolver,
    ISPTransactionResolver
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
    ISPCustomerAccountingResolver,
    ISPCustomerPaymentResolver,
    ISPTransactionResolver,
    SMSResolver
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
    allow_origins=["http://localhost", "http://localhost:3000", "https://w06z1rvh-80.inc1.devtunnels.ms"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GraphQL endpoint
app.include_router(graphql_app, prefix="/graphql")

# Mpesa API routes
app.include_router(mpesa.router, prefix="/api/isp-customer-payments", tags=["mpesa"])

# SMS API routes
app.include_router(sms.router, prefix="/api/sms", tags=["sms"])

@app.on_event("startup")
async def startup_db_client():
    """Connect to MongoDB on startup"""
    await connect_to_database()
    # Start the scheduler
    start_scheduler()

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    await close_database_connection()
