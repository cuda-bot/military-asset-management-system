# Military Asset Management System

A comprehensive web-based system for managing military assets including weapons, vehicles, ammunition, and other critical equipment across multiple bases. The system provides transparency, streamlines logistics, and ensures accountability through role-based access control.

## Features

### Core Functionality
- **Dashboard**: Real-time metrics and analytics with filtering capabilities
- **Asset Tracking**: Complete inventory management with opening/closing balances
- **Purchase Management**: Record and track asset purchases with supplier information
- **Transfer System**: Inter-base asset transfers with approval workflow
- **Assignments**: Track asset assignments to personnel and expenditures
- **Role-Based Access Control**: Secure access based on user roles

### User Roles
- **Admin**: Full system access and user management
- **Base Commander**: Access to assigned base data and operations
- **Logistics Officer**: Limited access to purchases and transfers

## Tech Stack

### Backend
- **Node.js** with Express.js framework
- **PostgreSQL** database for ACID compliance and complex relationships
- **JWT** for secure authentication
- **bcrypt** for password hashing
- **Winston** for comprehensive logging
- **Helmet** and rate limiting for security

### Frontend
- **React** with modern hooks and functional components
- **Material-UI** for responsive and professional UI
- **React Router** for navigation
- **React Query** for efficient data fetching
- **Recharts** for data visualization
- **Axios** for API communication

## Database Design

The system uses a relational database design with the following key tables:

- **bases**: Military base information
- **equipment_types**: Equipment categories and specifications
- **users**: User accounts with role-based permissions
- **user_bases**: Junction table for user-base assignments
- **assets**: Current inventory with balances
- **purchases**: Purchase records with supplier details
- **transfers**: Inter-base transfer requests and history
- **assignments**: Asset assignments to personnel
- **expenditures**: Asset consumption records
- **audit_logs**: Comprehensive transaction logging

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   - Copy `env.example` to `.env`
   - Update database connection details:
     ```
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=military_asset_mgmt
     DB_USER=your_username
     DB_PASSWORD=your_password
     ```
   - Set a secure JWT secret:
     ```
     JWT_SECRET=your_super_secret_jwt_key_here
     ```

4. **Database Setup**:
   ```bash
   # Create database
   createdb military_asset_mgmt
   
   # Run migrations
   npm run db:migrate
   
   # Seed initial data
   npm run db:seed
   ```

5. **Start the server**:
   ```bash
   npm run dev
   ```

The backend will be available at `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

## Demo Credentials

The system comes with pre-seeded demo accounts:

### Admin Access
- **Username**: `admin`
- **Password**: `admin123`
- **Capabilities**: Full system access, user management

### Base Commander (Fort Bragg)
- **Username**: `commander_bragg`
- **Password**: `commander123`
- **Capabilities**: Access to Fort Bragg data and operations

### Logistics Officer (Fort Bragg)
- **Username**: `logistics_bragg`
- **Password**: `logistics123`
- **Capabilities**: Purchase and transfer management for Fort Bragg

### Base Commander (Camp Pendleton)
- **Username**: `commander_pendleton`
- **Password**: `commander123`
- **Capabilities**: Access to Camp Pendleton data and operations

### Logistics Officer (Camp Pendleton)
- **Username**: `logistics_pendleton`
- **Password**: `logistics123`
- **Capabilities**: Purchase and transfer management for Camp Pendleton

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/auth/profile` - Get user profile

### Dashboard
- `GET /api/dashboard/metrics` - Get dashboard metrics
- `GET /api/dashboard/filters` - Get available filters

### Purchases
- `GET /api/purchases` - List purchases with pagination
- `POST /api/purchases` - Create new purchase
- `GET /api/purchases/:id` - Get purchase details
- `PUT /api/purchases/:id` - Update purchase (admin only)
- `DELETE /api/purchases/:id` - Delete purchase (admin only)

### Transfers
- `GET /api/transfers` - List transfers with pagination
- `POST /api/transfers` - Create transfer request
- `PUT /api/transfers/:id/approve` - Approve transfer
- `PUT /api/transfers/:id/complete` - Complete transfer
- `PUT /api/transfers/:id/cancel` - Cancel transfer

### Assignments
- `GET /api/assignments` - List assignments
- `POST /api/assignments` - Create assignment
- `PUT /api/assignments/:id/return` - Return assignment
- `GET /api/assignments/expenditures` - List expenditures
- `POST /api/assignments/expenditures` - Record expenditure

### Assets
- `GET /api/assets` - List assets with filters
- `GET /api/assets/:id` - Get asset details
- `GET /api/assets/categories` - Get asset categories

### Users (Admin Only)
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/activate` - Activate user
- `PUT /api/users/:id/deactivate` - Deactivate user

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions based on user roles
- **Base-Level Access Control**: Users can only access data for their assigned bases
- **Input Validation**: Comprehensive validation using express-validator
- **Rate Limiting**: Protection against brute force attacks
- **Helmet**: Security headers and protection
- **Audit Logging**: Complete transaction logging for accountability
- **Password Hashing**: Secure password storage using bcrypt

## Key Features

### Dashboard Analytics
- Real-time metrics display
- Opening and closing balances
- Net movement calculations
- Purchase and transfer tracking
- Assignment and expenditure monitoring
- Interactive charts and visualizations
- Date and base filtering

### Asset Management
- Complete inventory tracking
- Equipment categorization
- Quantity and balance management
- Serial number tracking
- Base-specific asset allocation

### Transfer Workflow
- Multi-step approval process
- Base-to-base transfers
- Status tracking (pending, approved, completed, cancelled)
- Quantity validation
- Automatic balance updates

### Purchase Management
- Supplier information tracking
- Cost analysis and reporting
- Invoice number management
- Automatic asset balance updates
- Historical purchase tracking

### Assignment Tracking
- Personnel assignment management
- Expected return dates
- Assignment status tracking
- Expenditure recording
- Return processing

## Development

### Project Structure
```
military-asset-mgmt/
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/      # Authentication and validation
│   ├── routes/          # API route handlers
│   ├── scripts/         # Database migration and seeding
│   ├── utils/           # Utility functions and logging
│   └── server.js        # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts
│   │   ├── services/    # API services
│   │   └── App.js       # Main app component
│   └── package.json
└── README.md
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository. 