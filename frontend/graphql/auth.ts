import { gql } from "@apollo/client";

export interface AuthResponse {
    success: boolean;
    message: string;
    token: string;
}

export interface LoginInput {
    email: string;
    password: string;
  }
  
  export interface RegisterInput {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
  }

export const SIGN_IN = gql`
    mutation Login($input: LoginInput!) {
        login(input: $input) {
            success
            message
            token
        }
    }
`;

export const REGISTER = gql`
    mutation Register($input: RegisterInput!) {
        register(input: $input) {
            success
            message
        }
    }
`;

export const GOOGLE_AUTH_URL = gql`
    mutation GoogleAuthUrl {
        googleAuthUrl
    }
`;

export const GOOGLE_CALLBACK = gql`
    mutation GoogleAuthCallback($code: String!) {
        googleAuthCallback(code: $code) {
            success
            message
            token
        }
    }
`;


export interface GoogleCallbackResponse {
    googleAuthCallback: AuthResponse;
}