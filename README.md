# PetPulse — Backend

Express + TypeScript + MongoDB API server for PetPulse, a marketplace for buying and selling pets, pet food, and pet accessories.

## Tech Stack

- Node.js + Express 5
- TypeScript
- MongoDB (native driver, hosted on Atlas)
- JWT verification via better-auth JWKS (protects write routes)
- Stripe payment confirmation (order creation triggered after successful checkout)

## Features

- Full CRUD for product listings
- Order creation and status tracking (pending/delivered)
- Payment status tracking (paid/unpaid) synced from Stripe
- User management (list, ban/unban, delete) for admin
- Product moderation (pending/active status) for admin
- Role-based route protection (JWT required for create/update/delete operations)

## API Overview

| Resource | Public Routes                        | Protected Routes       |
| -------- | ------------------------------------ | ---------------------- |
| Products | Get all, get by id, get by owner     | Create, update, delete |
| Orders   | Get all, get by buyer, get by seller | Create, update status  |
| Users    | Get all (non-admin)                  | Ban/unban, delete      |

## Related Repos

- Frontend: [[PetPulse.com](https://petpulse-flame.vercel.app/)]
