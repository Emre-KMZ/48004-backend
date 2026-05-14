import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";

const STATUS_STYLES = {
    pending: { background: "#FFF8E1", color: "#F57F17" },
    processing: { background: "#E3F2FD", color: "#1565C0" },
    shipped: { background: "#E8F5E9", color: "#2E7D32" },
    delivered: { background: "#F3E5F5", color: "#6A1B9A" },
    cancelled: { background: "#FFEBEE", color: "#C62828" },
};

function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    });
}

export default function OrderDetail() {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
    const fetchOrder = async () => {
        try {
        const res = await api.get(`/api/orders/${id}/`);
        setOrder(res.data);
        } catch (err) {
        if (err.response?.status === 404) {
            setNotFound(true);
        } else {
            setError("Failed to load order details.");
        }
        } finally {
        setLoading(false);
        }
    };

    fetchOrder();
    }, [id]);

    if (loading) {
    return (
        <div style={{ marginTop: "3rem", textAlign: "center", color: "#999" }}>
        Loading receipt...
        </div>
    );
    }

    if (notFound) {
    return (
        <div style={{ marginTop: "3rem", padding: "3rem", background: "#fff", borderRadius: "16px", textAlign: "center" }}>
        <h1 style={{ color: "#D81B60" }}>This order could not be found</h1>
        <p style={{ color: "#888" }}>The order may not exist or you may not have permission to view it.</p>
        <Link to="/orders" style={{ padding: "0.8rem 2rem", background: "#E91E63", color: "white", borderRadius: "25px", textDecoration: "none", fontWeight: "600" }}>
            Back to My Orders
        </Link>
        </div>
    );
    }

    if (error) {
    return (
        <div style={{ marginTop: "3rem", textAlign: "center", color: "#D32F2F" }}>
        {error}
        </div>
    );
    }

    const statusStyle = STATUS_STYLES[order.status] || { background: "#F5F5F5", color: "#555" };

    return (
    <div style={{ maxWidth: "900px", margin: "2rem auto", fontFamily: "Outfit" }}>
        <Link to="/orders" style={{ color: "#D81B60", textDecoration: "none", fontWeight: "600" }}>
        ← Back to My Orders
        </Link>

        <div style={{ marginTop: "1.5rem", background: "#fff", borderRadius: "18px", padding: "2rem", border: "1px solid #FCE4EC", boxShadow: "0 4px 15px rgba(233,30,99,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
            <div>
            <h1 style={{ color: "#D81B60", margin: 0 }}>Order #{order.order_id}</h1>
            <p style={{ color: "#888", marginTop: "0.5rem" }}>{formatDate(order.created_at)}</p>
            </div>

            <span style={{ height: "fit-content", padding: "0.4rem 1rem", borderRadius: "20px", fontWeight: "700", textTransform: "capitalize", ...statusStyle }}>
            {order.status}
            </span>
        </div>

        <h2 style={{ color: "#333", fontSize: "1.3rem" }}>Items</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {order.items?.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", border: "1px solid #FCE4EC", borderRadius: "14px" }}>
                <div style={{ width: "70px", height: "70px", borderRadius: "12px", background: "#FFF5F8", display: "flex", alignItems: "center", justifyContent: "center", color: "#D81B60", fontSize: "1.8rem" }}>
                🛍️
                </div>

                <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", color: "#333" }}>{item.product_name}</div>
                <div style={{ color: "#888", fontSize: "0.9rem" }}>Quantity: {item.quantity}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                <div style={{ color: "#888", fontSize: "0.85rem" }}>Paid price</div>
                <div style={{ fontWeight: "700" }}>${parseFloat(item.price_at_purchase).toFixed(2)}</div>
                </div>
            </div>
            ))}
        </div>

        <div style={{ marginTop: "2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div style={{ background: "#FFF5F8", padding: "1.5rem", borderRadius: "14px" }}>
            <h3 style={{ marginTop: 0, color: "#D81B60" }}>Shipping Address</h3>
            <p style={{ color: "#555", lineHeight: "1.6" }}>{order.shipping_address}</p>
            <p style={{ color: "#777" }}>
                {order.contact_name}<br />
                {order.contact_email}<br />
                {order.contact_phone}
            </p>
            </div>

            <div style={{ background: "#FFF5F8", padding: "1.5rem", borderRadius: "14px" }}>
            <h3 style={{ marginTop: 0, color: "#D81B60" }}>Summary</h3>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span>Subtotal</span>
                <strong>${parseFloat(order.total_price).toFixed(2)}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span>Shipping</span>
                <strong>$0.00</strong>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #F8BBD0", margin: "1rem 0" }} />

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", color: "#D81B60" }}>
                <span>Final Total</span>
                <strong>${parseFloat(order.total_price).toFixed(2)}</strong>
            </div>
            </div>
        </div>
        </div>
    </div>
    );
}