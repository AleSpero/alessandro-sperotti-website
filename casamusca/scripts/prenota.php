<?php
ini_set('display_errors', 1); error_reporting(E_ALL);
$field_name = $_POST['nome'];
$field_surname = $_POST['cognome'];
$field_tel = $_POST['tel'];
$field_chckin = $_POST['chckin'];
$field_chckout = $_POST['chckout'];
$field_email = $_POST['email'];
//$field_tel = $_POST['tel'];

$mail_to = 'alesperomegam@gmail.com';
$subject = 'Richiesta di Prenotazione da'.$field_name." ".$field_surname;

$body_message = 'Da: '.$field_name." ".$field_surname."\n";
$body_message .= 'E-mail: '.$field_email."\n";
$body_message .= 'Numero Di Telefono' .$field_tel. "\n";
$body_message .= 'Check-in: '.$field_chckin."\n".'Check-Out: '.$field_chckout;

$headers = 'From: '.$field_email."\r\n";
$headers .= 'Reply-To: '.$field_email."\r\n";

$mail_status = mail($mail_to, $subject, $body_message, $headers);

if ($mail_status) { ?>
	<script language="javascript" type="text/javascript">
		alert('La tua richiesta di prenotazione è stata effettuta. Entro 48 ore riceverai una mail di conferma.');
		window.location = '../index.html';
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