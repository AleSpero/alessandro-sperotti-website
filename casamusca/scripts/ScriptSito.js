var nomiCamere = new Array('Camera Rolling Stones','Camera Elton John', 'Camera Bob Dylan','Camera Jimmy Page','Camera Beatles','Camera Jim Morrison', 'Camera Toto', 'Camera Deep Purple','Camera Eagles');


function prenotaModal(){
    if(sessionStorage.getItem("currentuser")!=null){
        window.location.replace('../AreaPersonale.html');
    }
    
    else{
        window.location.replace('../index.html');
    }
}


function aggiornaDate(num){
    
var giaPrenotato = new Array();

//Creo array multidimensionale che conterrà le varie date prenotate per ogni camera
    
for(i=0;i<9;i++){
    giaPrenotato[i] = [];
}

var datacheckin;
var datacheckout;
var checkins = new Array();
var checkouts = new Array();
var i;
    
if(localStorage.getItem("prenotazioni") == null){
        localStorage.setItem("prenotazioni",'{ "prenotazioni": []}')
    }
    
var prenotazioni = JSON.parse(localStorage.getItem('prenotazioni'));
    


//Controllo quale camera è selezionata attualmente
    
var camera = nomiCamere[num];

for(i=0;i<prenotazioni.prenotazioni.length;i++){
    
    //Converto le date in oggetti di tipo date
    
    if(prenotazioni['prenotazioni'][i].stanza == camera){
    checkins = prenotazioni['prenotazioni'][i].checkin.split("/");
    checkouts = prenotazioni['prenotazioni'][i].checkout.split("/");
        
    datacheckin= new Date(checkins[2],checkins[1],checkins[0]);
     datacheckout= new Date(checkouts[2],checkouts[1],checkouts[0]);
    
    //Aggiungo le date tra il check-in ed il check-out come date non selezionabili
    
    while(datacheckin < datacheckout){
        giaPrenotato[num].push(datacheckin.getUTCDate()+1+"/"+datacheckin.getMonth()+"/"+datacheckin.getFullYear());
        datacheckin.setDate(datacheckin.getDate()+1);
    }
    
 }
}
    
   //In questa parte di codice 'inizializzo' il datepicker di bootstrap tramite jQuery.
    
          $('#checkin').datepicker({
              startDate: new Date(),
    format: "dd/mm/yyyy",
    language: "it",
    datesDisabled: giaPrenotato[num]
});
    
        $('#checkout').datepicker({
            startDate: new Date(),
    format: "dd/mm/yyyy",
    language: "it",
    datesDisabled: giaPrenotato[num]
});
    

    //Imposto come date non selezionabili le date precedentemente ottenute dal for.

    $('#checkin').datepicker('setDatesDisabled', giaPrenotato[num]);
    $('#checkout').datepicker('setDatesDisabled', giaPrenotato[num]);
    
    
}

function xmlModal(num){
        xmlhttp= new XMLHttpRequest();
        xmlhttp.open("GET", "../xml/Camere.xml",false);
        xmlhttp.send();
        xmlDoc=xmlhttp.responseXML;
    
    document.getElementById('titoloModal').innerHTML = xmlDoc.getElementsByTagName('nome')[num].childNodes[0].nodeValue;
    document.getElementById('dimensioniModal').innerHTML = xmlDoc.getElementsByTagName('dimensioni')[num].childNodes[0].nodeValue;
    document.getElementById('nropersoneModal').innerHTML = xmlDoc.getElementsByTagName('persone')[num].childNodes[0].nodeValue;
    document.getElementById('lettoModal').innerHTML = xmlDoc.getElementsByTagName('letto')[num].childNodes[0].nodeValue;
    document.getElementById('nrostanzeModal').innerHTML = xmlDoc.getElementsByTagName('stanze')[num].childNodes[0].nodeValue;
    document.getElementById('bagnoModal').innerHTML = xmlDoc.getElementsByTagName('bagno')[num].childNodes[0].nodeValue;
    document.getElementById('cancellazioneModal').innerHTML = xmlDoc.getElementsByTagName('canc')[num].childNodes[0].nodeValue;
    document.getElementById('prezzoModal').innerHTML = xmlDoc.getElementsByTagName('prezzo')[num].childNodes[0].nodeValue;
    
    document.getElementById('cameraModal').setAttribute('src', xmlDoc.getElementsByTagName('immagine')[num].childNodes[0].nodeValue);
    
    
}