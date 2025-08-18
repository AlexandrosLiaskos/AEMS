# DEMO SCRIPT - AEMS System
## 5-10 Minute Video Demonstration Guide

### OVERVIEW
This script provides a structured approach for demonstrating the AEMS system to showcase all key features and assignment requirements.

---

## DEMO STRUCTURE (8-10 minutes total)

### 🎬 INTRODUCTION (1 minute)
**Script**:
"Καλησπέρα! Σας παρουσιάζω το AEMS - Agentic Email Management System, τη λύση αυτοματισμού που αναπτύξαμε για την TechFlow Solutions. Το σύστημα αυτοματοποιεί τη διαχείριση emails και την εξαγωγή δεδομένων από PDF τιμολόγια, με πλήρη έλεγχο από τον χρήστη."

**Show**:
- AEMS login screen
- Brief overview of the dashboard

---

### 🔐 SYSTEM ACCESS & SETUP (1 minute)
**Script**:
"Πρώτα, συνδεόμαστε με το Gmail μας μέσω OAuth2 authentication για ασφαλή πρόσβαση."

**Demonstrate**:
1. Click "Connect Gmail" button
2. Show Google OAuth2 flow
3. Return to dashboard with connected status
4. Point out user profile icon and security features

---

### 📧 EMAIL SYNC & CATEGORIZATION (2 minutes)
**Script**:
"Το σύστημα συγχρονίζει αυτόματα τα emails και τα κατηγοριοποιεί με AI. Ας δούμε πώς λειτουργεί:"

**Demonstrate**:
1. Click sync button (🔄)
2. Show real-time sync process with loading indicators
3. Navigate to "Fetched" tab
4. Show categorized emails:
   - Customer Inquiries (ερωτήσεις πελατών)
   - Invoices (τιμολόγια)
   - Other (άλλα)
5. Explain AI categorization process
6. Show email details (sender, subject, date, category)

---

### 🤖 AI DATA EXTRACTION PROCESS (2 minutes)
**Script**:
"Τώρα θα επεξεργαστούμε τα emails με AI για εξαγωγή δεδομένων. Παρατηρήστε ότι ο χρήστης έχει πλήρη έλεγχο σε κάθε βήμα:"

**Demonstrate**:
1. Select a customer inquiry email
2. Click "Process" button
3. Show AI processing with progress indicator
4. Navigate to "Review" tab
5. Show extracted data:
   - Customer Name
   - Email
   - Phone
   - Company
   - Service Interest
6. Select an invoice email and process it
7. Show extracted invoice data:
   - Invoice Number
   - Date
   - Customer
   - Amount
   - VAT

---

### ✏️ HUMAN-IN-THE-LOOP CONTROLS (2 minutes)
**Script**:
"Το σύστημα δεν λειτουργεί πλήρως αυτόματα. Ο χρήστης έχει πλήρη έλεγχο και μπορεί να επεξεργάσει οποιοδήποτε στοιχείο:"

**Demonstrate**:
1. Click "Edit" on extracted data
2. Show manual editing interface
3. Modify some fields (e.g., correct customer name)
4. Save changes
5. Show approval options:
   - ✅ Approve (move to Managed)
   - ❌ Delete (move to recycle bin)
6. Demonstrate bulk operations
7. Show audit trail and logging

---

### 📊 FINAL STAGE & EXPORT (1.5 minutes)
**Script**:
"Μετά την έγκριση, τα δεδομένα μεταφέρονται στο τελικό στάδιο και μπορούν να εξαχθούν σε Excel:"

**Demonstrate**:
1. Navigate to "Managed" tab
2. Show approved emails and extracted data
3. Click "Export to Excel"
4. Show generated Excel file with:
   - Separate tabs for Customer Inquiries and Invoices
   - Properly formatted data
   - All extracted information
5. Open Excel file to show results

---

### 🔔 DASHBOARD & MONITORING (0.5 minutes)
**Script**:
"Το σύστημα παρέχει real-time monitoring και ειδοποιήσεις:"

**Demonstrate**:
1. Show notification system
2. Point out badge counters on tabs
3. Show system health indicators
4. Demonstrate search and filtering capabilities

---

### 🔒 SECURITY & ENTERPRISE FEATURES (1 minute)
**Script**:
"Το AEMS περιλαμβάνει enterprise-level ασφάλεια και χαρακτηριστικά:"

**Demonstrate**:
1. Show audit logging
2. Point out security headers and CSRF protection
3. Mention automated backups
4. Show error handling and recovery
5. Demonstrate recycle bin functionality

---

### 🎯 CONCLUSION (0.5 minutes)
**Script**:
"Το AEMS παρέχει μια ολοκληρωμένη λύση για την TechFlow Solutions που:
- Αυτοματοποιεί τη διαχείριση emails
- Εξάγει δεδομένα με AI
- Διατηρεί πλήρη έλεγχο χρήστη
- Προσφέρει enterprise ασφάλεια
- Είναι έτοιμο για άμεση χρήση"

**Show**:
- Final dashboard overview
- Contact information

---

## TECHNICAL SETUP FOR DEMO

### Pre-Demo Preparation:
1. **Clean Environment**: Fresh data directory with sample emails
2. **Test Data**: Prepare sample customer inquiries and invoice emails
3. **Gmail Account**: Use dedicated demo Gmail account
4. **Screen Recording**: Use high-quality screen recording software
5. **Audio**: Clear microphone setup for Greek narration

### Demo Environment:
```bash
# Start AEMS in demo mode
npm start

# Ensure clean state
rm -rf data/emails/*
mkdir -p data/emails/{fetched,review,managed}

# Have sample emails ready in Gmail account
```

### Key Points to Emphasize:
- ✅ **Human Control**: User approval required at every stage
- ✅ **No Mock Data**: Real AI processing and extraction
- ✅ **Production Ready**: Fully functional system
- ✅ **Enterprise Features**: Security, monitoring, backups
- ✅ **Business Value**: Addresses all TechFlow Solutions needs

---

## DEMO CHECKLIST

### Before Recording:
- [ ] System running smoothly
- [ ] Sample emails in Gmail account
- [ ] Clean data directory
- [ ] Audio/video setup tested
- [ ] Script reviewed

### During Demo:
- [ ] Speak clearly in Greek
- [ ] Show each feature systematically
- [ ] Emphasize user control aspects
- [ ] Demonstrate error handling
- [ ] Show real AI processing (no mocks)

### After Recording:
- [ ] Review video quality
- [ ] Check audio clarity
- [ ] Verify all features shown
- [ ] Export in appropriate format

---

## ALTERNATIVE DEMO FORMATS

### Live Demo Option:
- Present to assignment evaluators in real-time
- Allow for questions and interaction
- Demonstrate specific features on request

### Interactive Demo:
- Provide access to demo environment
- Include sample data and instructions
- Allow evaluators to test the system themselves

---

*Demo Script v1.0 - AEMS Project*
*AthenaGen AI Solutions Engineering Team*
*August 2025*
