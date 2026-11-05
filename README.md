# Smart Canteen Management System

A full-stack canteen pre-order and inventory management application built for the DBMS project. Students can browse the live menu, place orders for pickup, and review their order history, while staff and administrators can manage the canteen from a role-protected dashboard.

## Features

### Student experience

- Student registration and login
- Menu browsing by category
- Live item availability and inventory-aware cart quantities
- Pickup-slot selection with capacity checks
- Order placement with simulated UPI, card, cash, or wallet payment
- Payment retry handling when an order is created before payment succeeds
- Order history with item details, pickup time, payment status, and order status

### Staff and administrator dashboard

- Overview of orders, sales, payment modes, and order statuses
- Create, edit, deactivate, and delete food items
- Create, edit, and delete food categories
- Update inventory quantities and reorder levels
- Low-stock indicators
- Update order status through the order lifecycle
- Role-based access control for staff and administrators

### Database functionality

- ACID transactions for atomic order creation and inventory deduction
- Row-level locking to prevent concurrent stock inconsistencies
- Pickup-slot capacity validation
- SQL views for sales summaries and student order history
- SQL indexes for order history, pickup capacity, and status filtering
- Stored procedure for inventory updates
- Inventory validation trigger
- User-defined function for low-stock detection
- MongoDB activity logs and order-event logs

## Technology Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js App Router and Route Handlers
- **Relational database:** MySQL 8.0+
- **Document database:** MongoDB
- **Authentication:** Signed HTTP-only session cookie
- **Package manager:** npm

## Project Structure

```text
app/
  api/                 API routes for auth, menu, orders, payments, inventory, and reports
  student/             Student login, menu, and order-history pages
  dashboard/           Staff and administrator management dashboard
src/lib/
  auth.ts              Session authentication helpers
  db.ts                MySQL connection pool
  mongodb.ts           MongoDB client
  activity-log.ts      Activity logging helper
database/
  procedures/          Stored procedure, trigger, and function scripts
  views/               Reporting and order-history view scripts
```

## Prerequisites

- Node.js 20.9 or later
- npm
- MySQL 8.0 or later
- MongoDB running locally or a MongoDB connection URI

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```env
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=your_mysql_user
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=smart_canteen_db

   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DATABASE=smart_canteen_logs

   SESSION_SECRET=replace_with_a_long_random_secret
   ```
**Note:** Replace the placeholder credentials with your actual configuration.
Do not commit `.env.local` or expose database credentials and session secrets
in the repository.

3. Create the required `smart_canteen_db` schema and seed data in MySQL.

4. Apply the project database objects:

   - `database/procedures/01_update_inventory_stock.sql`
   - `database/procedures/02_inventory_triggers.sql`
   - `database/procedures/03_low_stock_function.sql`
   - `database/views/01_sales_summary_view.sql`
   - `database/views/02_student_order_views_and_indexes.sql`

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Start the production server
npm run lint      # Run ESLint
```

## Application Routes

- `/student/login` — Student registration and login
- `/student` — Student menu, cart, pickup slot, and checkout
- `/student/orders` — Student order history
- `/dashboard` — Staff and administrator dashboard

The root route redirects users based on their authenticated role. Unauthenticated users are redirected to the login page.

## Project Status

The Smart Canteen Management System is complete. The core student ordering flow, staff/admin dashboard, MySQL database operations, reporting views, inventory controls, payment recording, authentication, and MongoDB logging are implemented.
