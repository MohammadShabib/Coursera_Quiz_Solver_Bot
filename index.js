const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();

const COURSE = process.env.COURSE;
const DIR = process.env.DIR;

const { weeks, courseLink } = require(`./answers/${COURSE}/info`);
const deleteDir = () => {
    const dir = `./user_data${DIR}`;
    fs.rmdir(dir, { recursive: true, force: true  }, (err) => {
        if (err) {
            return;
        }

        console.log(`${dir} is deleted!`);
    });
};

const waitForMe = async (page, message) => {
    console.log(message, "\t**When you are done press the ( ` ) key**");
    let check = { val: false };
    await page.waitForFunction(
        async (check) => {
            document.onkeydown = (e) => {
                if (e.key == "`") {
                    check.val = true;
                    document.onkeydown = null;
                }
            };

            return check.val;
        },
        { timeout: 9990000 },
        check
    );
};
const signIn = async (page) => {
    console.log("signing in...");
    await page.goto("https://www.coursera.org/?authMode=login");
    await page.type("input[name='email']", process.env.EMAIL);
    await page.type("input[name='password']", process.env.PASSWORD);
    await page.click("button[type='submit']");
    await waitForMe(page, "Waiting for you to sign in!");
};

const FormSumbition = async (page) => {
    //accepting rules
    await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        input.click();
    }, `input[required]`);

    try {
        //Adding your Name
        await page.evaluate(
            (selector, fullName) => {
                const input = document.querySelector(selector);
                input.value = fullName;
            },
            `div[data-test="legal-name"] input`,
            process.env.FULLNAME
        );
    } catch {}
};
const Solve = async (page, week, quiz) => {
    console.log("Solving The Quiz!!");
    const ExamAnswers = await new Map(
        require(`./answers/${COURSE}/week${week}/quiz${quiz}`)
    );
    let count = 0;
    for (const [key, val] of ExamAnswers) {
        let res = await page.evaluate((key) => {
            let q = document.getElementById(`${key}`);
            console.log(q);
            return q ? true : false;
        }, key);

        if (res) {
            ++count;
            for (const ans of val) {
                try {
                    await page.evaluate((selector) => {
                        const input = document.querySelector(selector);
                        input.click();
                    }, `input[value="${ans}"]`);
                } catch (err) {
                    console.log(err);
                    console.log("Invalid valid option", key, ans);
                }
            }
        } else {
            console.log("invalid Key", key);
        }
    }

    await FormSumbition(page);

    console.log("Answered Questions: ", count);
};
const Review = async (page) => {
    while (true) {
        let vals = await page.$$(`input[type="radio"]`);
        for (const val of vals) {
            await val.click();
        }
        await page.type(`textarea`, "Good");
        await page.click(`button[data-track-component="submit"]`);
        await waitForMe(
            page,
            `If you want to review again stay on the page else change the fking page`
        );
    }
};
function main() {
    (async () => {
        const isSignIn = process.env.IS_SIGN_IN == "0" ? false : true;

        if (!isSignIn) deleteDir();

        const browser = await puppeteer.launch({
            headless: false,
            //devtools: true,
            userDataDir: `./user_data${DIR}`,
            args: [`--window-size=1920,960`],
            defaultViewport: {
                width: 1920,
                height: 960,
            },
        });

        const page = await browser.newPage();

        if (!isSignIn) await signIn(page);

        for (const [index, week] of weeks.entries()) {
            await page.goto(courseLink);
            for (const quiz of week) {
                let TYPE = !isNaN(quiz) ? "Quiz" : "Submition";
                const text = `week: ${index}, ${TYPE}: ${quiz}`;
                await waitForMe(page, `Waiting for ${text}`);
                try {
                    if (!isNaN(quiz)) await Solve(page, index, quiz);
                    else {
                        await Review(page);
                    }
                    await waitForMe(page, `Waiting for sumbition of ${text}.`);
                } catch (err) {
                    console.log(err);
                    console.log(`ERROR!!, couldn't solve ${text}.`);
                }
            }
        }

        await waitForMe(
            page,
            `Wow good job for doing nothing, YOU FINISHED THE FUCKING COURSE!!!`
        );
        await page.goto("https://www.coursera.org/completed");

        await waitForMe(page, `To close the browser`);
        await browser.close();
    })();
}

main();
