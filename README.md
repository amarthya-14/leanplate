# Leanplate

A personal fat-loss app built around your hostel mess. Upload the monthly mess menu (Excel), and every meal it tells you **what to take, how much, and what to leave on the counter**. It also helps with sugar cravings.

## Run it

```bash
cd ~/Downloads/leanplate
npm install        # first time only
npm run dev
```

Open http://localhost:5173. The terminal also prints a **Network** URL (like `http://192.168.x.x:5173`). Open that on your phone while you're on the same Wi-Fi, then use "Add to Home Screen" to get an app icon.

## Gemini (optional, recommended)

1. Get a free key at https://aistudio.google.com/apikey
2. Paste it in **Settings → Gemini**, then press **Test**. That loads the models your key can use, so pick a Flash model.

With a key, Gemini plans each day's plate from the actual menu, estimates anything you type into "Log food", reads unusual menu layouts, and runs the **Coach** chat. The coach can see your menu, your plan, what you've logged and your weight trend.

Without a key, the built-in offline engine still plans every meal. It uses a database of about 100 South-Indian mess dishes with portion and calorie rules.

You can also put the key in a `.env` file (see `.env.example`).

## Screens

- **Today**: a "Next move" card that changes with the time of day (meal coming up, craving window, protein gap, weigh-in, kitchen closed), plus calories left, protein, water, sugar-free streak, weight, and the plate for each meal. Untick what you didn't take, then tap "Ate this" to log it; every log can be undone.
- **Swap a dish**: tap ⇄ next to anything on the plate to see what on that meal's menu can take its place. Protein swaps for protein (dal counts), carbs for carbs, veg for veg. Portions are sized to similar calories, and each option shows the calorie and protein difference. Like-for-like swaps come first; sugary, fried or much heavier ones are listed separately as "Not great swaps".
- **Skip or miss a meal**: "Skip meal" (or "I missed it" once the mess has closed) marks the meal as skipped. You can just skip it, or also add a protein dish from your next main meal's menu so your protein stays on track. "Eating it after all" undoes it, and every change has an Undo.
- **Meal reminders**: a notification when the mess opens with what to take and what to skip (works while the app is open or in the background), and **Add month to calendar**, which exports every meal as calendar alerts that fire even when the app is closed.
- **Canteen & room quick-add**: one tap to log tea, samosa, Maggi, eggs, chocolate and other common extras, with sugary items marked.
- **Menu**: upload the month's Excel, switch between Veg/Non-Veg and Special, and browse any day with colour-coded dishes (good / small portion / skip).
- **Cravings**: a guided 10-minute reset, hostel-friendly swaps, a streak calendar, and your craving patterns.
- **Coach**: chat with Gemini about anything food-related. When its advice changes what you should eat ("sleep in and skip breakfast", "lighter dinner after that lunch"), it attaches a **plate change** card showing the new picks and before/after calories and protein. Tap **Update my plate**, or just reply "yes", and Today's plate is rewritten (skipped meals marked, with undo and "Back to original plan"). Mention food you ate and it offers to log it.
- **Progress**: a weekly review (days logged, average calories, on-target days, protein days, sugar-free days, weight change, and an optional Gemini debrief), weigh-ins, a 7-entry average trend, goal projection, and a 14-day calorie history.

## Menu format

Built for the VIT-AP style sheet: a `Day`/`Dates` column ("Thu 1, 15, 29") with Breakfast / Lunch / Snacks / Dinner columns, one dish per row. It handles:
- date-specific variants: `Veg Puff (1, 29), Boiled Peanuts (15)` or `(1st, 29th Mar)`
- date label lines inside a cell (`6th Mar` / `20th Mar`)
- multiple sheets (Veg & Non-Veg, Special)
- a "Mess timings" table, which is used to work out the "Up next" meal
- `.xlsx` and `.csv` (re-save old `.xls` files as `.xlsx`)

If a sheet doesn't match this format, Gemini can read it instead.

## Cloud sync

Sign-in and sync use a free Supabase project. Supabase pauses free projects after about a week without activity, and the app then says it can't reach the server. To prevent that, Vercel calls `api/keepalive.js` once a day (`vercel.json`). If the project was paused anyway, restore it from the Supabase dashboard. Everything on the device keeps working in the meantime.

## Data

Everything is stored in your browser's localStorage, so nothing is uploaded except the requests sent to Gemini. Use **Settings → Export backup** before clearing your browser or moving to another device.

## Targets

- Calories: Mifflin–St Jeor BMR × activity factor, minus a deficit set by your pace (0.25 / 0.5 / 0.75 kg a week). The deficit is capped at 25% of maintenance, with a floor of 1500 kcal (men) or 1200 kcal (women).
- Protein: max(1.6 g × goal weight, 1.1 g × current weight).
- BMI uses the Asian cut-offs (23 / 25).

This isn't medical advice. If you have diabetes, thyroid problems or anything similar, check your targets with a doctor.
