# LeadFlow — Daily Lead & Follow-up Manager

A small, responsive lead tracker for daily banking work. It helps record a customer's requirement, note the first call, set a date and time for the next contact, and record what happened during each follow-up.

## Main features

- **Dashboard:** today's pending follow-ups, overdue callbacks, active leads and interested customers.
- **Lead register:** save customer name, phone, location, purpose, requirement amount, source, status and remarks.
- **Follow-up scheduler:** set a specific date and time for a call, visit or other action.
- **Date-wise follow-up list:** Today, Overdue, Upcoming, Completed and All Pending filters.
- **Follow-up history:** open a customer to view their previous scheduled and completed contacts.
- **Log result:** record Interested, Call Back, No Answer, Not Interested, Converted or Other; optionally schedule the next contact immediately.
- **Search:** find leads by customer name, phone number, purpose or location.

## Technology

- Frontend: HTML, CSS and vanilla JavaScript
- Backend: Node.js and Express
- Database: MongoDB with Mongoose
- Separate MongoDB schemas: `models/Lead.js` and `models/FollowUp.js`

## Project structure

```text
leadflow-bank-tracker/
├── models/
│   ├── Lead.js
│   └── FollowUp.js
├── routes/
│   └── api.js
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── package.json
├── server.js
└── README.md
```

## Run locally

### 1. Install the requirements

Install **Node.js 20 or newer** and run MongoDB locally, or create a MongoDB Atlas database.

### 2. Install packages

Open a terminal inside this project folder:

```bash
npm install
```

### 3. Configure MongoDB

Copy `.env.example` to a new file named `.env` and set your MongoDB connection string:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/leadflow_bank_tracker
```

For MongoDB Atlas, replace the local value with your Atlas connection string. Keep `.env` private and do not share it.

### 4. Start the application

```bash
npm start
```

For development with automatic Node.js reload:

```bash
npm run dev
```

Open **http://localhost:5000** in your browser.

## How to use

1. Select **New lead** and add the customer's name, phone number, purpose and requirement amount.
2. Record the first-call remark. When the customer asks you to call later, select the next follow-up date and time before saving.
3. Open **Follow-ups** to see the day's list. Use Today, Overdue, Upcoming, Completed or All Pending to filter it.
4. After contacting a customer, select **Log result**, choose the outcome, add a remark and schedule the next date/time when required.
5. Select a customer in **Lead register** to review the contact history or schedule another follow-up.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard` | Dashboard counters and today's follow-ups |
| GET | `/api/leads` | Search and filter the lead register |
| POST | `/api/leads` | Create a lead and optional first follow-up |
| GET | `/api/leads/:id` | Lead details and follow-up history |
| PATCH | `/api/leads/:id` | Update lead fields |
| GET | `/api/follow-ups` | List follow-ups using date/status filters |
| POST | `/api/leads/:id/follow-ups` | Schedule another follow-up |
| POST | `/api/follow-ups/:id/complete` | Save a follow-up result and optional next callback |
| GET | `/api/health` | Check server and database connection status |

## Important notes

- Date filters use **India Standard Time (Asia/Kolkata)** so an India-based workday remains consistent even if the server runs in UTC.
- This is a lightweight **single-user MVP**. It does not include login, user roles, backups, audit-grade access controls or encryption at rest. Do not expose it publicly. Before entering any real customer information, confirm that your bank permits this workflow and that the database is an approved environment. Use dummy data while testing. Do not store customer documents, account numbers or other sensitive financial identifiers in this MVP.
- The current version stores basic contact and lead information only. It does not send SMS, WhatsApp or push notifications; due and overdue items appear inside the app.
