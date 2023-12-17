import express from "express";

const app = express();
app.use(function (req, res, next) {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", function (chunk) {
        data += chunk;
    });

    req.on("end", function () {
        req.body = data ? data : null;
        next();
    });
});

function copyHeaders(from, to) {
    from.headers.forEach((value, key) => {
        try {
            if (![
                "content-encoding"
            ].includes(key.toLowerCase())) {
                to.set(key, value);
            }
        } catch (e) {
            console.error(e);
        }
    });
}

app.all("*", async (req, res) => {
    try {
        let dstURL = req.originalUrl.substring("/".length);
        let response = await fetch(dstURL, {
            rejectUnauthorized: false,
            method: req.method,
            headers: {
                ...req.headers,
                referer: dstURL.origin,
                referrer: dstURL.origin,
                origin: dstURL.origin,
            },
            credentials: req.credentials,
            body: req.body,
            cache: req.cache,
            redirect: req.redirect,
            referrer: req.referrer,
            referrerPolicy: req.referrerPolicy,
            integrity: req.integrity
        });
        copyHeaders(response, res);
        if (req.path.startsWith("/fetch")) {
            res.set("Access-Control-Allow-Origin", "*");
            res.set("Access-Control-Allow-Methods", "*");
            res.set("Access-Control-Allow-Headers", "*");
            res.set("Access-Control-Allow-Private-Network", "true");
        }
        if (req.path.endsWith(".user.js")) {
            let script = await response.text();
            res.send(script.replace(/(?<===\/UserScript==\s*?\n)/, String.raw`
                const __old_GM__ = {
                    GM_getValue,
                    GM: { ...GM }
                };
                GM_getValue = (key, defaultValue) => __old_GM__.GM_getValue(key, defaultValue) ?? defaultValue;
                GM.getValue = async (key, defaultValue) => (await __old_GM__.GM.getValue(key, defaultValue)) ?? defaultValue;
                GM_notification = () => {};
            `.replaceAll("$", "$$$$")));
        } else {
            res.send(Buffer.from(await response.arrayBuffer()));
        }
    } catch (e) {
        console.error(req.path, e);
        res.status(500);
        if (e instanceof Error) {
            res.send(req.originalUrl + "\n" + e.stack);
        } else {
            res.send(req.originalUrl + "\n" + (e?.message || e?.name || e));
        }
    }
});

// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});
