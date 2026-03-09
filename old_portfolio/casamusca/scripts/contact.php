<?php
ini_set('display_errors', 1); error_reporting(E_ALL);
$field_name = $_POST['nomecognome'];
$field_email = $_POST['email'];
$field_message = $_POST['message'];
//$field_tel = $_POST['tel'];

$mail_to = 'alesperomegam@gmail.com';
$subject = 'Messaggio dal signor '.$field_name;

$body_message = 'Da: '.$field_name."\n";
$body_message .= 'E-mail: '.$field_email."\n";
//$body_message .= 'Numero Di Telefono' .$field_tel. "\n";
$body_message .= 'Messaggio: '.$field_message;

$headers = 'From: '.$field_email."\r\n";
$headers .= 'Reply-To: '.$field_email."\r\n";

$mail_status = mail($mail_to, $subject, $body_message, $headers);

if ($mail_status) { ?>
	<script language="javascript" type="text/javascript">
		alert('Grazie averci contattato. Risponderemo al più presto.');
		window.location = '../Contattaci.html';
	</script>
<?php
}
else { ?>
	<script language="javascript" type="text/javascript">
		alert('Messaggio fallito');
		window.location = '../Contattaci.html';
	</script>
<?php
}
?>