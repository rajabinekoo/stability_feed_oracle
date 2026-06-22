# Stability Feed Oracle

**Codes and main research by Ali Rajabi Nekoo**

## Description

Built with [NestJS](https://github.com/nestjs/nest) and TypeScript.

## Project setup

```bash
pnpm install
```

## Compile and run the project

> **Note:** Make sure to review and set up all **Dependencies** (e.g., MongoDB, Redis) and environment variables in the **Configuration** section before running the project.

```bash
# development
pnpm run start

# watch mode
pnpm run start:dev

# production mode
pnpm run start:prod
```

## Dependencies

This project uses **MongoDB** and **Redis** as its primary databases.  
Both services are defined in the `docker-compose.yml` file.

### Running the services

To start the databases and the application, simply run:

```bash
docker-compose up
```
This will bring up MongoDB, Redis, and any other required services defined in the compose file.
Make sure Docker and Docker Compose are installed on your machine.

## Configuration

Before running the project, you need to set up the environment variables.

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Open the .env file and update the variables as needed, such as:

- **`ETHERSCAN_APIS`** — very important  
  Enter your Etherscan API keys separated by commas `,` in a single line. Example:
  ```env
  ETHERSCAN_APIS=key1,key2,key3
  ```
- Database URLs (MongoDB, Redis) — update if different from defaults in `docker-compose.yml`
- Any other settings you want to customize

Make sure to save the file after editing.

## Dataset Import

Please follow comand below:

```bash
cd dataset
tar xvf oracle.tar.gz
```

The required datasets are located in the `dataset` directory:

```text
dataset
├── oracle.actions.json
└── oracle.swaps.json
```

Before running the application, you must create a MongoDB database named `oracle` and import the datasets into two collections:

* `actions`
* `swaps`

### Importing the datasets

If MongoDB is running through Docker Compose, you can import the data using the following commands:

```bash
mongoimport \
  --db oracle \
  --collection actions \
  --file dataset/oracle.actions.json \
  --jsonArray
```

```bash
mongoimport \
  --db oracle \
  --collection swaps \
  --file dataset/oracle.swaps.json \
  --jsonArray
```

### Verify imported collections

Open the MongoDB shell:

```bash
mongosh
```

Select the database:

```javascript
use oracle
```

List collections:

```javascript
show collections
```

Expected output:

```text
actions
swaps
```

Check document counts:

```javascript
db.actions.countDocuments()
db.swaps.countDocuments()
```

## Importing inside Docker

If MongoDB is running in a container named `mongodb`, you can import directly into the container:

```bash
docker cp dataset/oracle.actions.json mongodb:/tmp/actions.json
docker cp dataset/oracle.swaps.json mongodb:/tmp/swaps.json
```

```bash
docker exec -it mongodb mongoimport \
  --db oracle \
  --collection actions \
  --file /tmp/actions.json \
  --jsonArray
```

```bash
docker exec -it mongodb mongoimport \
  --db oracle \
  --collection swaps \
  --file /tmp/swaps.json \
  --jsonArray
```

After importing, the application will be able to access the oracle datasets from the `oracle` database.

## License

This project uses [NestJS](https://github.com/nestjs/nest), which is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

The custom parts of this project are released under the **Stability Feed Oracle LICENSE – NonCommercial ShareAlike Attribution License v1.0**.  
See the [LICENSE](./LICENSE) file for details.

**NonCommercial | ShareAlike | Attribution required**
