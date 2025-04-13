# FreeRADIUS REST API for ISP Management

This API provides a RESTful interface for FreeRADIUS using the `rlm_rest` module. It's designed to authenticate and authorize ISP customers using FreeRADIUS with Mikrotik devices.

## Features

- Username/password authentication
- Account status and expiration verification
- Automatic rate limiting based on customer packages
- Session accounting and tracking
- Support for Mikrotik-specific RADIUS attributes

## Prerequisites

- Python 3.8+
- MongoDB
- FreeRADIUS with rlm_rest module

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
MONGODB_URL=mongodb+srv://your_username:your_password@your_cluster.mongodb.net
DATABASE_NAME=your_database_name
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd radius
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the API:
```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000.

## FreeRADIUS Integration

1. Copy the `freeradius_config/rlm_rest.conf` file to your FreeRADIUS configuration directory (usually `/etc/freeradius/3.0/mods-available/rest`).

2. Enable the REST module:
```bash
cd /etc/freeradius/3.0/mods-enabled
ln -s ../mods-available/rest rest
```

3. Configure your site to use the REST module. Edit your site configuration (e.g., `/etc/freeradius/3.0/sites-available/default`) to include the REST module in the appropriate sections:

```
authorize {
    # Other modules...
    rest
}

authenticate {
    # Other modules...
    rest
}

accounting {
    # Other modules...
    rest
}

post-auth {
    # Other modules...
    rest
}
```

4. Restart FreeRADIUS:
```bash
systemctl restart freeradius
```

## API Endpoints

- `POST /api/radius/authorize`: RADIUS authorization endpoint
- `POST /api/radius/authenticate`: RADIUS authentication endpoint
- `POST /api/radius/accounting`: RADIUS accounting endpoint
- `GET /api/radius/status`: API status check endpoint

## Mikrotik Configuration

To configure Mikrotik to use FreeRADIUS, add the following to your Mikrotik configuration:

```
/radius add address=<freeradius-server-ip> secret=<shared-secret> service=ppp
/ppp profile set default use-radius=yes
```

## Development

API documentation is available at http://localhost:8000/docs when the server is running.

## License

[MIT License](LICENSE) 