# NinerMarket

**A campus marketplace for UNC Charlotte. Buy, sell, and trade with students on campus.**

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)

---

<img width="2558" height="1599" alt="image" src="https://github.com/user-attachments/assets/a07ee414-2bf3-4942-b10b-77632c8fc19d" />


## What it does

NinerMarket is a Facebook-Marketplace-style app for the campus community. Students
post listings with photos and a pickup location, browse and search the marketplace,
message sellers, make offers, and save items, all tied to their account.

---

## How it works

1. **Frontend:** React + TypeScript SPA with live search, filters, listing galleries, and an inbox
2. **Backend:** FastAPI REST API: auth, listings, saved items, offers, messaging, ratings, notifications, and photo uploads
3. **Data & realtime:** Supabase provides Postgres, Storage (listing photos), and Realtime (live badge updates); web push delivers notifications to closed tabs

---

## Features

<table>
<tr>
<td><strong>Listings</strong></td>
<td>Post items with photos, price, category, condition, and pickup location</td>
</tr>
<tr>
<td><strong>Search &amp; Filter</strong></td>
<td>Server-side keyword search plus category, price, location, and condition filters</td>
</tr>
<tr>
<td><strong>Saved Listings</strong></td>
<td>Bookmark items, synced to your account</td>
</tr>
<tr>
<td><strong>Messaging</strong></td>
<td>Per-listing conversations with sellers</td>
</tr>
<tr>
<td><strong>Offers</strong></td>
<td>Make and respond to price offers</td>
</tr>
<tr>
<td><strong>Ratings</strong></td>
<td>Rate sellers after a deal</td>
</tr>
<tr>
<td><strong>Notifications</strong></td>
<td>In-app bell plus web push to closed tabs</td>
</tr>
<tr>
<td><strong>Accounts</strong></td>
<td>Email/password and Google sign-in, with password reset</td>
</tr>
<tr>
<td><strong>Moderation</strong></td>
<td>Report listings</td>
</tr>
</table>

---

## Tech Stack

<table>
<tr>
<td><strong>Frontend</strong></td>
<td>React 18, TypeScript, Vite, Zustand</td>
</tr>
<tr>
<td><strong>Backend</strong></td>
<td>FastAPI, Python, Uvicorn</td>
</tr>
<tr>
<td><strong>Database</strong></td>
<td>PostgreSQL (Supabase)</td>
</tr>
<tr>
<td><strong>Storage</strong></td>
<td>Supabase Storage (listing photos)</td>
</tr>
<tr>
<td><strong>Auth</strong></td>
<td>Session tokens + Google OAuth</td>
</tr>
<tr>
<td><strong>Realtime &amp; Push</strong></td>
<td>Supabase Realtime, Web Push (VAPID)</td>
</tr>
</table>

---

> **Developers:** for setup, build, and deployment instructions, see [dev.md](dev.md).
