public class Bevanda extends Prodotto{
    
    private int volume;
    
    public Bevanda(int costo, String nome, int volume) {
        super(costo,nome);
        this.volume=volume
    }
    
    public int getCosto(){
        return costo;
    }
}