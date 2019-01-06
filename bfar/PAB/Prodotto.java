public abstract class Prodotto {
    
    private int costo;
    private int nome;
    
    public Prodotto(int costo,String nome){
        this.costo=costo;
        this.nome=nome;
    }

    public abstract int getCosto();
}