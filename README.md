# Military Asset Management System

This app helps you keep track of military assets—like vehicles, equipment, and supplies—across different bases. It's built to make inventory, purchases, transfers, and assignments easy for everyone.

## What You Can Do
- See a dashboard with key stats
- Track assets and their locations
- Record purchases and suppliers
- Transfer assets between bases
- Assign equipment to people
- Manage users and roles

## How to Run the Project

### Backend
1. Go to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `env.example` to `.env` and fill in your database and JWT info.
4. Set up the database:
   ```bash
   createdb military_asset_mgmt
   npm run db:migrate
   npm run db:seed
   ```
5. Start the backend:
   ```bash
   npm run dev
   ```
   The backend runs at [http://localhost:5000](http://localhost:5000)

### Frontend
1. Go to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend:
   ```bash
   npm start
   ```
   The frontend runs at [http://localhost:3000](http://localhost:3000)

## Demo Logins
- **Admin:** `admin` / `admin123`
- **Base Commander:** `commander_bragg` / `commander123`
- **Logistics Officer:** `logistics_bragg` / `logistics123`

## Need Help?
If you get stuck, open an issue or ask a teammate. We're happy to help.

---

Thanks for checking out this project! 