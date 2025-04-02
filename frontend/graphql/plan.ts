import { gql } from "@apollo/client";

export const GET_PLANS = gql`
    query GetPlans {
        plans {
            success
            message
            plans {
                id
                name
                description
                price
                currency
                features
                createdAt
                updatedAt
            }
        }
    }
`;

export const GET_PLAN = gql`
    query GetPlan($id: String!) {
        plan(id: $id) {
            id
            name
            description
            price
            currency
            features
            createdAt
            updatedAt
        }
    }
`;

export const CREATE_PLAN = gql`
    mutation CreatePlan($input: CreatePlanInput!) {
        createPlan(input: $input) {
            success
            message
            plan {
                id
                name
                description
                price
                currency
                features
                createdAt
                updatedAt
            }
        }
    }
`;

export const UPDATE_PLAN = gql`
    mutation UpdatePlan($id: String!, $input: CreatePlanInput!) {
        updatePlan(id: $id, input: $input) {
            success
            message
            plan {
                id
                name
                description
                price
                currency
                features
                createdAt
                updatedAt
            }
        }
    }
`;

export const DELETE_PLAN = gql`
    mutation DeletePlan($id: String!) {
        deletePlan(id: $id) {
            success
            message
            plan {
                id
                name
                description
                price
                currency
                features
                createdAt
                updatedAt
            }
        }
    }
`;
