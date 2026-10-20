# Student survey (GBU One)

Ten questions, about four minutes. The answers decide what the app improves
next, so the wording is deliberately concrete: no "do you like the app?".

**How to run it:** send the link to the class representatives, or print this
page. Collect the answers, drop them into `docs/qa/survey-responses.csv` and
tick the roadmap item "Student survey results reviewed; update priorities".

The sheet has one column per question, exactly as the questions are numbered
below, plus a first column `respondent` for a roll number or an anonymous
label. A respondent label is enough - no names are needed.

| respondent | q1 | q2 | q3 | q4 | q5 | q6 | q7 | q8 | q9 | q10 |
|---|---|---|---|---|---|---|---|---|---|---|

## The questions

1. **Which year and branch are you in?**
   *(the answer is used to group the results, not to identify you)*

2. **How often do you open the GBU notices page itself (the university
   website)?** — never / once a month / weekly / a few times a week / daily

3. **Which of these do you check today because they are not in one place?**
   *(tick all that apply)* — exam date sheet / fee deadlines / result
   announcements / scholarship forms / hostel circulars / placement drives /
   attendance rules / none of these

4. **A deadline is announced in a notice. How do you usually find out?**
   — the website / a friend or a batchmate / a teacher / a class representative
   / I usually miss it

5. **What do you do first when a circular says "last date 31 Oct"?**
   — read it carefully / skim it / ask someone / save it for later / ignore it

6. **How long does it take you to work out which papers apply to your
   section?** — under a minute / a few minutes / longer than that / I do not
   manage it

7. **Have you ever missed a deadline or a form that you knew about but
   could not act on in time?** — no / once / more than once
   *(if yes, which one? what stopped you?)*

8. **On which phone do you use it most?** — Android / iPhone / both equally
   *(this decides where the release effort goes)*

9. **What would you delete from the app tomorrow if you could?**
   *(free text - the most useful answer on this sheet)*

10. **What should the app do that it cannot do today?**
    *(free text - one thing only)*

## How to read the results

Once `docs/qa/survey-responses.csv` is filled in, the answers map onto the
roadmap like this:

| Signal | What it changes |
|---|---|
| Q3 mentions a topic often | that topic gets a first-class screen, not a notice list |
| Q4/Q5 show a discovery problem | the deadline tracker and the reminder become the priority |
| Q7 shows people missing forms | add a deadline reminder the student can act on |
| Q8 is mostly Android | Android releases first; the Play track stays the priority |
| Q9/Q10 name the same thing twice | that becomes the next thing built |

The review itself is recorded in `docs/ROADMAP.md` and the reasoning in
`docs/OPEN_QUESTIONS.md`.
