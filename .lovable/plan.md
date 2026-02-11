
# Redesign Search Orders Page - Kvatt Returns Portal Style

## Overview
Redesign the `/search-orders` public page to match the clean, minimal Kvatt returns portal aesthetic shown in the reference images. The page will have a warm beige background, centered content, the Kvatt bird logo at the top, and a multi-step flow.

## Design Approach
The new layout will follow the reference images closely:
- **Background**: Warm beige/cream (`#e8e4de` or similar)
- **Typography**: Clean, bold headings, minimal text
- **Layout**: Centered content, max-width container, no cards/borders
- **Logo**: Kvatt bird logo centered at the top (already in `src/assets/kvatt-logo.jpeg`)
- **Buttons**: Black rounded buttons with white text
- **Support footer**: "Need support" section with email and WhatsApp info at the bottom

## Multi-Step Flow

### Step 1: Initial Screen
- Kvatt logo centered
- Heading: "Let's find your order"
- Email input field
- Black "find order" button
- Support info at bottom

### Step 2: Results Screen
- "< back" link top-left
- Kvatt logo centered
- "We found a match!" subtext
- Heading: "Select your order below"
- List of orders grouped by store, showing order number, date, and amount
- Black "confirm & start return" button (links to return portal)
- Support info at bottom

### Step 3: No results / Error
- Same layout with message "No orders found"

## Technical Details

### File: `src/pages/SearchOrders.tsx`
- Complete UI overhaul while keeping all existing logic (search, API calls, store mappings, return portal URLs)
- Replace Card-based layout with a full-page beige background centered layout
- Add step-based state management (`step: 'search' | 'results'`)
- Use the existing `kvatt-logo.jpeg` from `src/assets/`
- Style with Tailwind using custom colors for the beige theme
- Responsive design matching the mobile version shown in references
- Add "< back" navigation between steps
- Add support section with `returns@kvatt.com` and `+44 (0) 75.49.88.48.50`
- Selected order state for the "confirm & start return" button that opens the return portal

### Key styling changes:
- Full viewport height beige background
- No sidebar, no dashboard chrome (already standalone)
- Centered column layout, max-width ~480px
- Input fields: simple border, rounded
- Buttons: `bg-black text-white rounded-full` style
- Order list items: beige cards with subtle border, radio-button selection
