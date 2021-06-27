 # MAILBOSS

A fullstack web application where users can login and send 
recurring mails to the recipients.

## SCREENSHOTS
### Home-page (all the scheduled mails reside here)
![alt text](https://github.com/cyberboy007/mailboss-work/blob/main/images.mailboss/WhatsApp%20Image%202021-06-27%20at%209.40.09%20PM%20(1).jpeg?raw=true)
### Compose-page (we can create and edit mail features)
![alt text](https://github.com/cyberboy007/mailboss-work/blob/main/images.mailboss/WhatsApp%20Image%202021-06-27%20at%209.40.10%20PM.jpeg?raw=true)
### Login Page
![alt text](https://github.com/cyberboy007/mailboss-work/blob/main/images.mailboss/WhatsApp%20Image%202021-06-27%20at%209.40.07%20PM.jpeg?raw=true)

## Quick Start 
Download it in your browser and type the following to get started (It will install all the node modules)       
- npm i

Note that you need not to login to sendinblue or create account on sendinblue just verify yourself with the link you get in your email .
- You can login with your google account as well .
- Per user limit of 50 email per day is set 
- You can directly set the time at which you want to deliver the mail . Also you need to put the email receiptents separated by comma (,) and no space is allowed while composing and 
 and sending mail .
 - You need to enter subject while composing mail It is compulsory .

## WORKING 
- Create your account
- Activate your account
- If you forget your password you can reset it via a link sent to your email
- Once logged into your account you will have the list of all the mails **Scheduled** for future
- You can even toggle to the-    
    - **HISTORY** page  where you have the list of all mails sent till now
    - **COMPOSE** page where you can create,schedule and edit mails


## FEATURES
### Mail Features
- General features includes- 
    - To
    - Cc
    - Bcc
    - Mail Body
    - Schedule Selector  
- Scheduling Features-
    - You can send mail on any date or time 
    - SOOO YOU CAN Send it on any Schedule
    - Weekly 
    - Monthly 
    - Yearly
 - Text editing Features-
    - Making text Bold or Italic
    - Changing font-color
    - Changing font-type
    - Changing font-type
    - Text-align
    - Adding bullet points



## TECH-STACK
  - **CLIENT:**   HTML, CSS, JAVASCRIPT, EJS 
  - **SERVER:**   NODE, EXPRESS, PASSPORTJS ,nodemailer ,tld-extract ,express-session,passport-local-mongoose ,mongoose-findorcreate and some more modules are used 
  - **DATABASES:**   MongoDB-Atlas
