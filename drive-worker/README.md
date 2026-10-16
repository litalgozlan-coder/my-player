# שירים מגוגל דרייב בנגן

השרת הקטן הזה (Cloudflare Worker) מאפשר לנגן להשמיע קבצי שמע מתיקיות דרייב שאישרת.
הקבצים נשארים פרטיים: רק מי שמחובר לנגן עם חשבון ספוטיפיי שהמייל שלו ברשימה יכול לשמוע אותם.

## שלב 1: חשבון שירות בגוגל (פעם אחת)

1. להיכנס ל־https://console.cloud.google.com וליצור פרויקט חדש בשם `my-player`.
2. בתפריט: **APIs & Services → Library**, לחפש **Google Drive API** וללחוץ **Enable**.
3. בתפריט: **IAM & Admin → Service Accounts → Create service account**. שם: `my-player-drive`. ללחוץ **Done** (בלי לתת תפקידים).
4. ללחוץ על חשבון השירות שנוצר → לשונית **Keys → Add key → Create new key → JSON**. יורד קובץ JSON למחשב. לשמור אותו בצד ולא לשתף.
5. להעתיק את כתובת המייל של חשבון השירות (נראית כמו `my-player-drive@my-player-xxxx.iam.gserviceaccount.com`).
6. בגוגל דרייב: על כל תיקייה שאישרת לנגן → **שיתוף** → להדביק את המייל של חשבון השירות → הרשאת **צפייה** → לבטל "שליחת הודעה" → **שיתוף**.

## שלב 2: השרת ב־Cloudflare

1. ב־https://dash.cloudflare.com: **Workers & Pages → Create → Create Worker**. שם: `my-player-drive` → **Deploy**.
2. **Edit code**, למחוק את מה שיש, להדביק את כל התוכן של `worker.js` מהתיקייה הזאת → **Deploy**.
3. **Settings → Variables and Secrets → Add**, ארבעה ערכים:

| שם | סוג | ערך |
|---|---|---|
| `GOOGLE_SA_KEY` | Secret | כל התוכן של קובץ ה־JSON משלב 1 |
| `SIGN_SECRET` | Secret | מחרוזת אקראית ארוכה (אפשר להקליד 40 תווים כלשהם) |
| `ALLOWED_EMAILS` | Text | המיילים של חשבונות הספוטיפיי המורשים, מופרדים בפסיקים |
| `DRIVE_FOLDERS` | Text | מזהי התיקיות המאושרות, מופרדים בפסיקים |

   אפשר להוסיף גם `EXCLUDE_FILES` (Text) עם מזהי קבצים שלא יופיעו.
4. להעתיק את כתובת השרת (נראית כמו `https://my-player-drive.xxxx.workers.dev`) ולשלוח ל־Claude. היא נכנסת לשורה `const DRIVE_API` ב־`index.html`.

## שלב 3: סינון אתרים בטלפונים של הילדים

ב־Family Link, להוסיף לרשימת האתרים המאושרים גם את `workers.dev`.

## מזהה של תיקייה

המזהה הוא החלק שאחרי `/folders/` בקישור של התיקייה בדרייב.

## התוכן שאושר (אוקטובר 2026)

**DRIVE_FOLDERS** (להדביק כמו שזה):

```
1o34W17PkLRAxIV3ncsEfyZ-VJcTotQqu,126lFye1e4vhScpxwZQDb641z_jug3E0m,1BswZ-kIycg4vLwyhu1MD7SkGOvfs0bGb,1QX4soz8M2aA_oBquqmypZadg7ws08hBd,1yfjckklec03YVXiif9LE_PJURlyqT_hC,1fn6nYZVfRRr1_x0J5zTIiph_1QQ13Qy4
```

התיקיות: דוידוני, סיפורים, בחצי הלילה, כוכבים, מתנות, משפחת שאבעס. (התיקייה "לנעמה המווששלמת" לא נכללת.)

**DRIVE_FILES** (שיר בודד – יחפים, מתוך התיקייה של נעמה):

```
1WkcjFTvcXu8afLdgRpV0plj-ajOHPf9-
```

בשלב 1 סעיף 6 צריך לשתף עם חשבון השירות את שש התיקיות האלה, ואת הקובץ "יסמין מועלם - יחפים" לבד (לא את התיקייה של נעמה).

**ALLOWED_EMAILS**:

```
lital.gozlan@gmail.com,naama.samara@gmail.com,daniel.haim.samara@gmail.com,guligulsamara@gmail.com
```

(אם החשבון הספוטיפיי שלך רשום על מייל אחר, צריך להחליף את הראשון.)
