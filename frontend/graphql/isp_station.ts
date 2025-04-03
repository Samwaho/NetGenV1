import { gql } from "@apollo/client";

export const GET_ISP_STATIONS = gql`
  query GetISPStations {
    stations {
      success
      message
      stations {
        id
        name
        description
        organization {
          id
          name
        }
        location
        buildingType
        notes
        status
        coordinates
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_ISP_STATION = gql`
  query GetISPStation($id: String!) {
    station(id: $id) {
      success
      message
      station {
        id
        name
        description
        organization {
          id
          name
        }
        location
        buildingType
        notes
        status
        coordinates
        createdAt
        updatedAt
      }
    }
  }
`;

export const CREATE_ISP_STATION = gql`
  mutation CreateISPStation($input: CreateISPStationInput!) {
    createStation(input: $input) {
      success
      message
      station {
        id
        name
        description
        organization {
          id
          name
        }
        location
        buildingType
        notes
        status
        coordinates
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_ISP_STATION = gql`
  mutation UpdateISPStation($id: String!, $input: UpdateISPStationInput!) {
    updateStation(id: $id, input: $input) {
      success
      message
      station {
        id
        name
        description
        location
        buildingType
        notes
        status
        coordinates
        updatedAt
      }
    }
  }
`;