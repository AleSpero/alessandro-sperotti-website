<?php
header('Content-Type: application/json');

$log_file = __DIR__ . '/contact_log.txt';
$turnstile_secret = '0x4AAAAAAC1qEIhVVGlk2qcjMWHSBV5AZ6U';

function write_log($log_file, $msg) {
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($log_file, "[$timestamp] $msg\n", FILE_APPEND);
}

write_log($log_file, "--- New request ---");
write_log($log_file, "POST data: " . json_encode($_POST));

$cf_token = isset($_POST['cf-turnstile-response']) ? $_POST['cf-turnstile-response'] : '';
if (empty($cf_token)) {
    write_log($log_file, "Turnstile token missing");
    echo json_encode(["success" => false, "reason" => "captcha_missing"]);
    exit;
}

$remoteip = isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? $_SERVER['HTTP_CF_CONNECTING_IP']
         : (isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? $_SERVER['HTTP_X_FORWARDED_FOR']
         : $_SERVER['REMOTE_ADDR']);

$verify_data = [
    'secret'   => $turnstile_secret,
    'response' => $cf_token,
    'remoteip' => $remoteip
];

$ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($verify_data));
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$verify_raw = curl_exec($ch);
$curl_err = curl_error($ch);
curl_close($ch);

write_log($log_file, "Turnstile verify response: " . ($verify_raw ? $verify_raw : "CURL ERROR: $curl_err"));

if (!$verify_raw) {
    write_log($log_file, "Turnstile API request failed");
    echo json_encode(["success" => false, "reason" => "captcha_error"]);
    exit;
}

$verify_res = json_decode($verify_raw, true);

if (!$verify_res || empty($verify_res['success'])) {
    write_log($log_file, "Turnstile verification failed");
    echo json_encode(["success" => false, "reason" => "captcha_failed"]);
    exit;
}

if (empty($_POST['name']) ||
    empty($_POST['email']) ||
    empty($_POST['message']) ||
    !filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
    write_log($log_file, "Validation failed - missing fields or invalid email");
    echo json_encode(["success" => false, "reason" => "validation"]);
    exit;
}

$name = strip_tags($_POST['name']);
$email_address = strip_tags($_POST['email']);
$message = strip_tags($_POST['message']);

$to = 'alessandro@sperodevs.com';
$email_subject = "Website Contact Form: $name";
$email_body = "You have received a new message from your website contact form.\n\n"
    . "Name: $name\n"
    . "Email: $email_address\n\n"
    . "Message:\n$message";
$headers = "From: noreply@alessandrosperotti.com\n";
$headers .= "Reply-To: $email_address";

write_log($log_file, "Sending mail to: $to, subject: $email_subject");

$sent = mail($to, $email_subject, $email_body, $headers);

write_log($log_file, "mail() returned: " . ($sent ? "true" : "false"));

if (!$sent) {
    $err = error_get_last();
    write_log($log_file, "Last error: " . json_encode($err));
}

echo json_encode(["success" => $sent]);
?>
