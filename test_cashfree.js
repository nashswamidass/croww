const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const generateCfSignature = (clientId) => {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const dataToEncrypt = `${clientId}.${timestamp}`;
        const publicKeyPath = path.join(__dirname, "functions", "cashfree_public_key.pem");
        const publicKey = fs.readFileSync(publicKeyPath, "utf8");
        const buffer = Buffer.from(dataToEncrypt, "utf8");
        const encrypted = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha1",
            },
            buffer
        );
        return encrypted.toString("base64");
    } catch (e) {
        console.error("error", e);
    }
};

const run = async () => {
    const clientId = "CF1206869D6QFJH12A26C73CI1I2G";
    const clientSecret = "cfsk_ma_prod_bcde0f526b710378c423e797d726a11a_c67ba97e";
    const signature = generateCfSignature(clientId);
    console.log("Sig:", signature);

    const apiResponse = await fetch("https://api.cashfree.com/verification/digilocker", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
            "x-api-version": "2023-08-01",
            "x-cf-signature": signature
        },
        body: JSON.stringify({
            verification_id: "kyc_test_final_12345",
            document_requested: ["AADHAAR"],
            redirect_url: "https://croww.app/kyc-complete",
            user_flow: "signup"
        })
    });
    
    console.log(await apiResponse.text());
};

run();
