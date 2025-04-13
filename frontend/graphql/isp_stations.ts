import { gql } from "@apollo/client";

const STATION_FIELDS = gql`
  fragment StationFields on ISPStation {
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
`;

export const GET_ISP_STATIONS = gql`
  query GetISPStations(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "createdAt",
    $sortDirection: String = "desc",
    $search: String = null,
    $filterStatus: String = null
  ) {
    stations(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection,
      search: $search,
      filterStatus: $filterStatus
    ) {
      success
      message
      stations {
        ...StationFields
      }
      totalCount
    }
  }
  ${STATION_FIELDS}
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

export const DELETE_ISP_STATION = gql`
  mutation DeleteISPStation($id: String!) {
    deleteStation(id: $id) {
      success
      message
      station {
        id
        name
      }
    }
  }
`;



