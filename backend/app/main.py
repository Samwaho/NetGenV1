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
from app.resolvers.sms_template import SmsTemplateResolver
from app.api import mpesa, sms, hotspot, organizations
from app.resolvers.dashboard import DashboardResolver

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
    ISPTransactionResolver,
    SmsTemplateResolver,
    DashboardResolver
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
    SMSResolver,
    SmsTemplateResolver
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
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "https://ispinnacle.co.ke",
        "http://ispinnacle.co.ke"
    ],  # Allow specific frontend origins
    allow_credentials=True,  # Allow credentials for authentication
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=1728000,
)

# GraphQL endpoint
app.include_router(graphql_app, prefix="/graphql")

# Organization API routes
app.include_router(organizations.router, prefix="/api/organizations", tags=["organizations"])

# Payment API routes
app.include_router(mpesa.router, prefix="/api/payments", tags=["payments"])

# SMS API routes
app.include_router(sms.router, prefix="/api/sms", tags=["sms"])

# Hotspot API routes
app.include_router(hotspot.router, prefix="/api/hotspot", tags=["hotspot"])

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

@app.on_event("startup")
async def startup_db_client():
    """Connect to MongoDB on startup"""
    await connect_to_database()

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    await close_database_connection()
