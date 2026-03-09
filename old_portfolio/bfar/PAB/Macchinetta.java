public class Macchinetta {
    
    private ArrayList<Prodotti> prod = new ArrayList<Prodotti>();
    
    public Macchinetta(){
        
    }
    
    public void aggiungiProdotto(Prodotto prodotto){
        prod.add(prodotto);
    }
    
    public Merendina compraMerendina(int soldi){
        
        for(int i=0;i<prod.length;i++){
         if(prod.get(i) instanceof Merendina && prod.get(i).getCosto() <= soldi){
             return prod.get(i);
         } 
        }
    return null;
    
    }
}
