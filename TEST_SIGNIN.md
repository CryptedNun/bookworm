# Quick Sign-In Testing Guide 🧪

## 🚨 HUMAN ACTION REQUIRED

The sign-in optimization is complete, but I need you to test it in the browser.

---

## Step 1: Start the Development Server

```bash
cd /home/thepg/Projects/BookWorm/bookworm
npm run dev
```

**Expected output:**
```
▲ Next.js 16.3.0
- Local: http://localhost:3000
✓ Ready in 2.5s
```

---

## Step 2: Test Happy Path (Email Login)

1. Open browser to `http://localhost:3000`
2. You should see the login page
3. **Enter:**
   - Username/Email: `alice@bookworm.dev`
   - Password: `anything` (password not checked yet)
4. Click **"Sign In to BookWorm"**

**Expected behavior:**
- ✅ Button shows spinner + "Signing in..."
- ✅ Within 300-500ms, redirects to `/dashboard`
- ✅ Dashboard shows Alice's notebooks and stats
- ✅ No errors in browser console

---

## Step 3: Test Username Login

1. Go back to `http://localhost:3000` (or click sign out)
2. **Enter:**
   - Username/Email: `alice` (just the username)
   - Password: `anything`
3. Click **"Sign In to BookWorm"**

**Expected behavior:**
- ✅ Should work exactly the same as email login
- ✅ Redirects to dashboard
- ✅ Signed in as Alice

---

## Step 4: Test Error Handling

1. Go back to login page
2. **Enter:**
   - Username/Email: `nonexistent@email.com`
   - Password: `anything`
3. Click **"Sign In to BookWorm"**

**Expected behavior:**
- ✅ Red error banner appears at top of form
- ✅ Message: "User not found. Try: alice@bookworm.dev, bob@bookworm.dev, or charlie@bookworm.dev"
- ✅ Error is dismissable (X button)
- ✅ Can try again without page reload

---

## Step 5: Test Quick Demo Button

1. On login page, click **"Instant Demo Access (as @alice)"**

**Expected behavior:**
- ✅ Automatically logs in as alice
- ✅ Same fast performance (~300-500ms)
- ✅ Redirects to dashboard

---

## Step 6: Test Loading States

1. Go back to login page
2. Enter valid credentials
3. **Watch closely** as you click "Sign In"

**Expected behavior:**
- ✅ Spinner appears immediately
- ✅ Text changes to "Signing in..."
- ✅ Button becomes slightly dimmed (disabled)
- ✅ "Quick Demo" button also disabled during loading

---

## Step 7: Check Server Logs

In the terminal where `npm run dev` is running, you should see:

```
✅ User signed in successfully: alice
```

---

## Step 8: Test Other Users (Optional)

Try logging in as:
- `bob@bookworm.dev` or `bob`
- `charlie@bookworm.dev` or `charlie`

All should work the same way.

---

## 🐛 If Something Goes Wrong

### Error: "Database connection failed"

**Check:**
```bash
# Verify .env.local exists
cat .env.local | grep DATABASE_URL

# Should show:
# DATABASE_URL=postgresql://neondb_owner:npg_Xy8f1FaHcVCU@...
```

**Fix:** Make sure .env.local has the correct DATABASE_URL

### Error: "User not found" for alice

**Check database:**
```bash
psql $DATABASE_URL -c "SELECT email, username, is_active FROM users WHERE email = 'alice@bookworm.dev';"
```

**Should return:**
```
        email        | username | is_active
---------------------+----------+-----------
 alice@bookworm.dev | alice    | t
```

**If empty:** Run seed script:
```bash
psql $DATABASE_URL -f seed_data.sql
```

### Page hangs on sign-in

**Check browser console** (F12):
- Look for JavaScript errors
- Check Network tab for failed requests

**Check server logs:**
- Look for database errors
- Check for timeout messages

---

## ✅ Success Checklist

- [ ] Can sign in with email (alice@bookworm.dev)
- [ ] Can sign in with username (alice)
- [ ] Invalid credentials show error message
- [ ] Error is dismissable
- [ ] Quick Demo button works
- [ ] Loading spinner appears
- [ ] Buttons disabled during loading
- [ ] Redirects to dashboard after success
- [ ] No console errors
- [ ] Server logs show "✅ User signed in successfully"

---

## 📊 Performance Check

Time the sign-in process:

1. Click "Sign In"
2. Count seconds until dashboard appears
3. Should be **< 1 second** typically

If it takes longer:
- Check network tab in browser (F12 → Network)
- Look for slow requests
- Check Neon dashboard for query performance

---

## 🎉 When Everything Works

Reply back with:
> ✅ Sign-in tested and working! Average time: ~XXX ms

Then I can continue with the next feature!

---

## 🚨 If You Hit Issues

Reply back with:
> ❌ Issue: [Describe what happened]
> 
> **What I did:** [Steps you took]
> **Expected:** [What should happen]
> **Actual:** [What actually happened]
> **Console errors:** [Copy/paste any errors]
> **Server logs:** [Copy/paste relevant logs]

I'll help debug!
