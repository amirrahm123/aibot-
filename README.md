# שומר המחיר — PriceGuard

מערכת חכמה לבדיקת מחירי חשבוניות עם בינה מלאכותית.

AI-powered invoice price verification system for Israeli businesses.

---

## מה זה עושה?

1. **העלאת חשבוניות** — PDF או תמונה
2. **הגדרת מחירים מוסכמים** — לכל ספק ומוצר
3. **זיהוי אוטומטי של חריגות מחיר** — בעזרת AI
4. **דו"ח חריגות** — כולל שליחת הודעה לספק בוואטסאפ

---

## ארכיטקטורה

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────┐
│   React Client  │────▶│  Express Server  │────▶│  MongoDB │
│   (Vite + TS)   │     │   (Node + TS)    │     │          │
└─────────────────┘     └────────┬─────────┘     └──────────┘
                                 │
                        ┌────────▼─────────┐
                        │   Claude API     │
                        │ (Invoice Parser) │
                        └──────────────────┘
```

---

## דרישות מקדימות

- Node.js 18+
- MongoDB (מקומי או Docker)
- מפתח API של Anthropic (Claude)

---

## התקנה

```bash
# שכפול הפרויקט
git clone <repo-url>
cd priceguard

# התקנת תלויות
npm run install:all

# העתקת קובץ סביבה
cp .env.example .env
# ערוך את .env עם הפרטים שלך

# הפעלת MongoDB (עם Docker)
docker compose up -d mongodb

# הרצה במצב פיתוח
npm run dev
```

---

## משתני סביבה

| משתנה | תיאור | ברירת מחדל |
|-------|--------|------------|
| `ANTHROPIC_API_KEY` | מפתח API של Anthropic | (נדרש) |
| `MONGODB_URI` | כתובת MongoDB | `mongodb://localhost:27017/priceguard` |
| `JWT_SECRET` | סוד ליצירת טוקנים | (נדרש) |
| `PORT` | פורט השרת | `3001` |
| `UPLOAD_DIR` | תיקיית העלאות | `./uploads` |
| `NODE_ENV` | סביבה | `development` |

---

## איך להוסיף ספק והסכמי מחיר

1. היכנס למערכת (או הירשם)
2. לך לעמוד **ספקים** → **הוסף ספק**
3. לך לעמוד **הסכמי מחיר** → **הסכם חדש** — או ייבוא CSV
4. לכל מוצר, הגדר: שם מוצר, יחידה (ק"ג/יחידה/ליטר), מחיר מוסכם

### ייבוא CSV

הורד תבנית CSV מעמוד ההסכמים. פורמט:
```
supplier_name,product_name,unit,agreed_price,notes
ירקות כהן בע"מ,עגבניות,kg,4.50,
```

---

## איך עיבוד חשבונית עובד

1. המשתמש מעלה קובץ (PDF/תמונה) + בוחר ספק
2. הקובץ נשמר בשרת ומומר ל-base64
3. נשלח ל-Claude API לחילוץ כל שורות הפריטים
4. כל פריט מותאם להסכם מחיר (fuzzy match בעברית)
5. חישוב חריגות: מחיר בחשבונית > מחיר מוסכם
6. הצגת דו"ח מפורט עם אפשרות שליחה לספק

---

## סקריפטים

```bash
npm run dev          # הרצת שרת + קליינט
npm run dev:server   # שרת בלבד
npm run dev:client   # קליינט בלבד
npm run build        # בניית פרודקשן
npm run install:all  # התקנת כל התלויות
cd server && npm test # הרצת בדיקות
```

---

## טכנולוגיות

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Zustand, Recharts
- **Backend**: Node.js, Express, TypeScript, Mongoose
- **AI**: Claude claude-sonnet-4-20250514 (Anthropic API)
- **DB**: MongoDB
- **Auth**: JWT + bcrypt

---

## רישיון

MIT
