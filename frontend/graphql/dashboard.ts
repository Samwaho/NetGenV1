import { gql } from '@apollo/client';

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats($organizationId: String!) {
    dashboardStats(organizationId: $organizationId) {
      customers {
        total
        active
        inactive
        growth
        churnRate
        averageRevenue
        newThisMonth
        byPackage {
          name
          count
          percentage
          revenue
        }
      }
      stations {
        total
        active
        inactive
        growth
        totalBandwidth
        averageUptime
        maintenanceNeeded
        byStatus {
          status
          count
          percentage
          bandwidth
        }
      }
      tickets {
        total
        open
        closed
        growth
        averageResolutionTime
        byPriority {
          priority
          count
          percentage
          avgResolutionTime
        }
        byCategory {
          category
          count
          percentage
        }
        satisfactionRate
      }
      inventory {
        total
        lowStock
        outOfStock
        growth
        totalValue
        mostUsed {
          name
          quantity
          usageCount
          value
        }
        reorderNeeded {
          name
          currentStock
          minimumRequired
          value
        }
        byCategory {
          category
          count
          value
        }
      }
      revenue {
        data {
          date
          amount
          recurring
          oneTime
          expenses
        }
        growth
        totalRevenue
        recurringRevenue
        averageRevenue
        projectedRevenue
        expenses
        profitMargin
      }
      bandwidth {
        total
        download
        upload
        peakTime
        byPackage {
          package
          usage
          percentage
        }
      }
      recentActivity {
        id
        type
        description
        timestamp
        user
        category
        impact
        details {
          details {
            key
            value
          }
        }
      }
    }
  }
`;




