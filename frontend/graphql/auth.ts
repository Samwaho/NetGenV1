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
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
}

export const CURRENT_USER = gql`
    query CurrentUser {
        currentUser {
            id
            email
            firstName
            lastName
            phone
            organizations{
                id
            }
        }
    }
`;

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
            userEmail
        }
    }
`;

export const VERIFY_EMAIL = gql`
    mutation VerifyEmail($token: String!) {
        verifyEmail(token: $token) {
            success
            message
        }
    }
`;

export const RESEND_VERIFICATION = gql`
    mutation ResendVerificationEmail($email: String!) {
        resendVerificationEmail(email: $email) {
            success
            message
        }
    }
`;

export const FORGOT_PASSWORD = gql`
    mutation ForgotPassword($email: String!) {
        forgotPassword(email: $email) {
            success
            message
        }
    }
`;

export const RESET_PASSWORD = gql`
    mutation ResetPassword($token: String!, $newPassword: String!) {
        resetPassword(token: $token, newPassword: $newPassword) {
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

export interface VerifyEmailResponse {
    verifyEmail: AuthResponse;
}

export interface ResendVerificationResponse {
    resendVerificationEmail: AuthResponse;
}

export interface ForgotPasswordResponse {
    forgotPassword: AuthResponse;
}

export interface ResetPasswordResponse {
    resetPassword: AuthResponse;
}